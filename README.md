# @ilpt/systemic-ts

A minimal type-safe dependency injection library, based on and compatible with [systemic](https://www.npmjs.com/package/systemic).

## Installation

```shell
$ npm install @ilpt/systemic-ts
```
## tl;dr

### Define the system

```typescript
import { systemic } from '@ilpt/systemic-ts';
import initConfig from './components/config';
import initLogger from './components/logger';
import initMongo from './components/mongo';

export const initSystem =  () => systemic()
  .add('config', initConfig(), { scoped: true })
  .add('logger', initLogger()).dependsOn('config')
  .add('mongo.primary', initMongo()).dependsOn('config', 'logger')
  .add('mongo.secondary', initMongo()).dependsOn('config', 'logger');
```

### Run the system

```typescript
import { initSystem } from './system';

const events = { SIGTERM: 0, SIGINT: 0, unhandledRejection: 1, error: 1 };

async function start() {
  const system = initSystem();
  const { config, mongo, logger } = await system.start();

  console.log('System has started. Press CTRL+C to stop');

  for (const name of Object.keys(events)) {
    process.on(name, async () => {
      await system.stop();
      console.log('System has stopped');
      process.exit(events[name]);
    });
  }
}

start();
```

## Why Use Dependency Injection With Node.js?

Node.js applications tend to be small and have few layers than applications developed in other languages such as Java. This reduces the benefit of dependency injection, which encouraged [the Single Responsibility Principle](https://en.wikipedia.org/wiki/Single_responsibility_principle), discouraged [God Objects](https://en.wikipedia.org/wiki/God_object) and facilitated unit testing through [test doubles](https://en.wikipedia.org/wiki/Test_double).

However when writing microservices the life cycle of an application and its dependencies is a nuisance to manage over and over again. We want a way to consistently express that our service should establish database connections before listening for http requests, and shutdown those connections only after it had stopped listening. We find that before doing anything we need to load config from remote sources, and configure loggers. This is why one uses DI.

The journey that led to [@ilpt/systemic-ts](https://www.npmjs.com/package/@ilpt/systemic-ts) started with a dependency injection framework called [electrician](https://www.npmjs.com/package/electrician) by our friends at Tes. It served its purpose well, but the API had a couple of limitations that they wanted to fix. This would have required a backwards incompatible change, so instead a new DI library was written - [systemic](https://www.npmjs.com/package/systemic). In late 2021 an attempt was made to add typescript definitions, but the types where incomplete and difficult to debug. This is why [Teun Mooij](https://github.com/teunmooij) decided to completely re-write the library in typescript, mostly compatible with it's predecessor, but fully type safe, which we adopted at [Infinitas Learning](https://github.com/infinitaslearning) - [@ilpt/systemic-ts](https://www.npmjs.com/package/@ilpt/systemic-ts).


## Concepts

`@ilpt/systemic-ts` has 4 main concepts

1. Systems
1. Runners
1. Components
1. Dependencies

### Systems

You add components and their dependencies to a system. When you start the system, `@ilpt/systemic-ts` iterates through all the components, starting them in the order derived from the dependency graph. When you stop the system, `@ilpt/systemic-ts` iterates through all the components stopping them in the reverse order.

```typescript
import { systemic } from '@ilpt/systemic-ts';
import initConfig from './components/config';
import initLogger from './components/logger';
import initMongo from './components/mongo';

const events = { SIGTERM: 0, SIGINT: 0, unhandledRejection: 1, error: 1 };

async function init() {
  const system = systemic()
    .add('config', initConfig(), { scoped: true })
    .add('logger', initLogger()).dependsOn('config')
    .add('mongo.primary', initMongo()).dependsOn('config', 'logger')
    .add('mongo.secondary', initMongo()).dependsOn('config', 'logger');

  const { config, mongo, logger } = await system.start();

  console.log('System has started. Press CTRL+C to stop');

  for (const name of Object.keys(events)) {
    process.on(name, async () => {
      await system.stop();
      console.log('System has stopped');
      process.exit(events[name]);
    });
  }
}

init();
```

### Runners

While not shown in the above examples we usually separate the system definition from system start. This is important for testing since you often want to make changes to the system definition (e.g. replacing components with stubs), before starting the system. By wrapping the system definition in a function you create a new system in each of your tests.

```typescript
// system.ts
export const initSystem = () => systemic()
  .add('config', initConfig())
  .add('logger', initLogger()).dependsOn('config')
  .add('mongo', initMongo()).dependsOn('config', 'logger');
```

```typescript
// index.ts
import { initSystem } from './system';

const events = { SIGTERM: 0, SIGINT: 0, unhandledRejection: 1, error: 1 };

async function start() {
  const system = initSystem();
  const { config, mongo, logger } = await system.start();

  console.log('System has started. Press CTRL+C to stop');

  for (const name of Object.keys(events)) {
    process.on(name, async () => {
      await system.stop();
      console.log('System has stopped');
      process.exit(events[name]);
    });
  }
}

start();
```

There are some out of the box runners that can be used in your applications or as a reference for your own custom runner

1. [Service Runner](https://npmjs.com/package/@ilpt/systemic-ts-service-runner)

```typescript
import { runner } from '@ilpt/systemic-ts-service-runner';

import system from './system';

runner(system()).start().then(components => {
  console.log('Started');
});
```

### Components

A component is or wraps the underlying resource that makes up the system. It has optional start and stop functions. The start function should return or yield the underlying resource after it has been started. e.g.

```typescript
type Dependencies = {
  config: { url: string };
};

export function initMongo() {
  let db;

  async function start({ config }: Dependencies) {
    db = await MongoClient.connect(config.url);
    return db;
  }

  async function stop() {
    return db.close();
  }

  return {
    start,
    stop,
  };
};

const system = systemic().add('mongo', initMongo());
```

The components stop function is useful for when you want to disconnect from an external service or release some other kind of resource.

`@ilpt/systemic-ts` supports multiple types of components:

#### (A)synchronous components

(A)synchronous components look like the `initMongo` component in the example above. They have a start function that returns the underlying resource and an optional stop function. Both start and stop function can be either synchronous or asynchronous.

#### Plain object components

Plain object components do not have a start function and are added to the system as-is. They will not be started or stopped, but can be injected into other component like any other component.

```typescript
const logger = {
  info(message: string) {
    console.log(message);
  }
}

const system = systemic().add('logger', logger);
```

#### Function components

Function components are similar to the `start` function of the (a)synchronous component. The function is called on system start and the returned resource is added to the system.

```typescript
import type { BookService } from './book-service';

type Dependencies = {
  bookService: BookService
}

function booksDomain({ bookService }: Dependencies) {
  return {
    async getBooks() {
      return bookService.getBooks()
    }
  }
}

const system = systemic().add('booksDomain', booksDomain)
```

#### Callback components

Support for callback components has been dropped in `@ilpt/systemic-ts` in favor of synchronous components. To maintain backwards compatibility with existing components written for legacy `systemic`, `@ilpt/systemic-ts` includes a migration helper to convert them into asynchronous components.

```typescript
import initRabbit from 'systemic-rabbitmq';
import { promisifyComponent } from '@ilpt/systemic-ts/migrate';

const system = systemic().add('rabbit', promisifyComponent(initRabbit()));
```

### Dependencies

A component's dependencies must be registered with the system

```typescript
import { systemic } from '@ilpt/systemic-ts';
import initConfig from './components/config';
import initLogger from './components/logger';
import initMongo from './components/mongo';

const system = systemic()
  .add('config', initConfig())
  .add('logger', initLogger()).dependsOn('config')
  .add('mongo', initMongo()).dependsOn('config', 'logger');
```

The components dependencies are injected via it's start function

```typescript
async function start({ config }) {
  db = await MongoClient.connect(config.url);
  return db;
}
```

#### Mapping dependencies

You can rename dependencies passed to a components start function by specifying a mapping object instead of a simple string

```typescript
const system = systemic()
  .add('config', initConfig())
  .add('mongo', initMongo())
  .dependsOn({ component: 'config', destination: 'options' });
```

If you want to inject a property or subdocument of the dependency thing you can also express this with a dependency mapping

```typescript
const system = systemic()
  .add('config', initConfig())
  .add('mongo', initMongo())
  .dependsOn({ component: 'config', source: 'mongo' });
```

Now `config.mongo` will be injected as `config` instead of the entire configuration object.

#### Scoped Dependencies

Injecting a sub document from a json configuration file is such a common use case, you can enable this behaviour automatically by 'scoping' the component. The following code is equivalent to that above

```typescript
const system = systemic()
  .add('config', initConfig(), { scoped: true })
  .add('mongo', initMongo())
  .dependsOn('config');
```

#### Optional Dependencies

By default an error is thrown if a dependency is not available on system start. Sometimes a component might have an optional dependency on a component that may or may not be available in the system, typically when working with subsystems. In this situation a dependency can be marked as optional.

```typescript
const system = systemic()
  .add('app', app())
  .add('server', server())
  .dependsOn('app', { component: 'routes', optional: true });
```

### Overriding Components

Attempting to add the same component twice will result in an error, but sometimes you need to replace existing components with test doubles. Under such circumstances use `set` instead of `add`

```typescript
import system from '../src/system';
import stub from './stubs/store';

const testSystem = system().set('store', stub);
```

### Removing Components

Removing components during tests can decrease startup time.

```typescript
import system from '../src/system';

const testSystem = system().remove('server');
```

`@ilpt/systemic-ts` does not allow you to delete components that other components depend on.

### Including components from another system

You can simplify large systems by breaking them up into smaller ones, then including their component definitions into the main system.

```typescript
// db-system.ts
import { systemic } from '@ilpt/systemic-ts';
import initMongo from './components/mongo';

type DependenciesFromMaster = {
  logger: Logger;
  config: { component: Config, scoped: true }
};

export function initDbSystem() { 
  return systemic<DependenciesFromMaster>()
    .add('mongo', initMongo())
    .dependsOn('config', 'logger');
};
```

```typescript
// system.ts
import { systemic } from '@ilpt/systemic-ts';
import initUtilSystem from './util-system';
import initWebSystem from './web-system';
import initDbSystem from './db-system';

import initConfig from './config';
import initLogger from './logger';

const system = systemic()
  .add('config', initConfig(), { scoped: true})
  .add('logger', initLogger()).dependsOn('config')
  .include(initUtilSystem())
  .include(initWebSystem())
  .include(initDbSystem());
```

### Grouping components

Sometimes it's convenient to depend on a group of components. e.g.

```typescript
const system = systemic()
  .add('app', app())
  .add('routes.admin', adminRoutes())
  .dependsOn('app')
  .add('routes.api', apiRoutes())
  .dependsOn('app')
  .add('routes')
  .dependsOn('routes.admin', 'routes.api')
  .add('server')
  .dependsOn('app', 'routes');
```

The above example will create a component 'routes', which will depend on routes.admin and routes.api and be injected as

```typescript
 {
  routes: {
    admin: { ... },
    adpi: { ... }
  }
 }
```

### Debugging

You can debug systemic by setting the DEBUG environment variable to `systemic:*`. Naming your systems will make reading the debug output easier when you have more than one.

```typescript
// system.ts
import { systemic } from '@ilpt/systemic-ts';
import initRoutes from './routes';

const system = systemic({ name: 'server' })
  .include(initRoutes());
```

```typescript
// routes/index.ts
import { systemic } from '@ilpt/systemic-ts';
import adminRoutes from './admin-routes';
import apiRoutes from './api-routes';

export default () => systemic({ name: 'routes' })
  .add('routes.admin', adminRoutes())
  .add('routes.api', apiRoutes())
  .add('routes')
  .dependsOn('routes.admin', 'routes.api');
```

```
DEBUG='systemic:*' node system
systemic:index Adding component routes.admin to system routes +0ms
systemic:index Adding component routes.api to system auth +2ms
systemic:index Adding component routes to system auth +1ms
systemic:index Including definitions from sub system routes into system server +0ms
systemic:index Starting system server +0ms
systemic:index Inspecting component routes.admin +0ms
systemic:index Starting component routes.admin +0ms
systemic:index Component routes.admin started +15ms
systemic:index Inspecting component routes.api +0ms
systemic:index Starting component routes.api +0ms
systemic:index Component routes.api started +15ms
systemic:index Inspecting component routes +0ms
systemic:index Injecting dependency routes.admin as routes.admin into routes +0ms
systemic:index Injecting dependency routes.api as routes.api into routes +0ms
systemic:index Starting component routes +0ms
systemic:index Component routes started +15ms
systemic:index Injecting dependency routes as routes into server +1ms
systemic:index System server started +15ms
```

## Migration from Systemic to @ilpt/systemic-ts

Since `@ilpt/systemic-ts` is mostly compatible with `systemic`, you can migrate your existing `systemic` service to `@ilpt/systemic-ts` with minimal effort.

### Compatibility

`@ilpt/systemic-ts` is mostly compatible with `systemic`. The differences are:
- the main `systemic` export is now a named export, for better esm vs commonjs compatibility
- the `bootstrap` function has been removed, since it was not type safe
- `@ilpt/systemic-ts` does not support callback components, but includes a migration helper to convert them to asynchronous components
- the `start` and `stop` functions of the system now return a promise, instead of taking a callback. To maintain compatibility with existing runners, a migration helper is included to convert the system to a callback based system. 
- `systemic` subsystems need to be converted to `@ilpt/systemic-ts` systems with the included migration helper, before they can be included in a `@ilpt/systemic-ts` system.

### Available migration helpers

#### Promisify component

When using a callback component, it's best to convert them to an asynchronous component. However, if you're importing a component from a library, you might not be able to change the source code. In this case, you can use the `promisifyComponent` helper to convert the component to an asynchronous component.

```typescript
import initRabbit from 'systemic-rabbitmq';
import { promisifyComponent } from '@ilpt/systemic-ts/migrate';

const system = systemic().add('rabbit', promisifyComponent(initRabbit()));
```

#### Use a legacy runner

If you're using a runner that expects a callback based system, you can use the `asCallbackSystem` helper to convert the system to a callback based system.

```typescript
import { asCallbackSystem } from '@ilpt/systemic-ts/migrate';
import runner from 'systemic-service-runner';

import { initSystem } from './system';

runner(asCallbackSystem(initSystem())).start((err, components) => {
  if (err) throw err;
  console.log('Started');
});
```

#### Upgrade a (sub)system

If you have a `systemic` subsystem that you want to include in a `@ilpt/systemic-ts` system, you can use the `upgradeSystem` helper to convert the subsystem to a `@ilpt/systemic-ts` system.

```typescript
import { upgradeSystem } from '@ilpt/systemic-ts/migrate';
import initSubSystem from 'my-legacy-subsystem';

const system = upgradeSystem(initSubSystem());
```

### Migration steps

1. Replace all `systemic` imports with `@ilpt/systemic-ts`
1. Change all callback components to asynchronous components, either by changing the source code or using the `promisifyComponent` helper
1. If the system includes subsystems that you cannot convert, use the `upgradeSystem` helper to convert them to `@ilpt/systemic-ts` systems.
1. If subsystems are included using the `bootstrap` functions, use the `include` function instead to add them to the main system. 
1. If you're using a runner that expects a callback based system, choose a different runner or use the `asCallbackSystem` helper to convert the system to a callback based system.
