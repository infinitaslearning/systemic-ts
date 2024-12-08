import type { ComponentTypeOf, DependenciesOf, IsComponent } from "./component";
import type { Definition, Registration } from "./definition";
import type {
  DependencyDestinationsOf,
  DependencyValidationError,
  DependsOnOption,
  Injected,
  ValidateDependencies,
  ToMappingDependsOnOption,
} from "./dependencies";
import type { SystemOf } from "./system";
import type {
  DeepRequiredOnly,
  DeleteProps,
  EmptyObject,
  RequiredKeys,
  SetNestedProp,
  StripEmptyObjectsRecursively,
} from "./util";

/**
 * Systemic system.
 */
export interface Systemic<TSystem extends Record<string, Registration>> {
  /**
   * The name of the system
   */
  readonly name: string;

  /**
   * Adds a component to the system
   * @param {string} name the name under which the component will be registered in the system
   * @param {Component} component the component to be added
   * @param options registration options
   */
  add<S extends string, TComponent = unknown, Scoped extends boolean = false>(
    name: S extends keyof TSystem ? never : S, // We don't allow duplicate names
    component: TComponent,
    options?: { scoped?: Scoped },
  ): SystemicBuild<
    {
      [G in keyof TSystem | S]: G extends keyof TSystem
        ? TSystem[G]
        : IsComponent<TComponent> extends true
          ? { component: ComponentTypeOf<TComponent>; scoped: Scoped }
          : { component: TComponent; scoped: Scoped };
    },
    S,
    DependenciesOf<TComponent>
  >;
  add<S extends string>(
    name: S extends keyof TSystem ? never : S, // We don't allow duplicate names,
  ): SystemicBuildDefaultComponent<
    {
      [G in keyof TSystem | S]: G extends keyof TSystem
        ? TSystem[G]
        : { component: EmptyObject; scoped: false };
    },
    S
  >;

  /**
   * Attempting to add the same component twice will result in an error, but sometimes you need to replace existing components with test doubles. Under such circumstances use set instead of add.
   * @param {string} name the name under which the component will be registered in the system
   * @param {Component} component the component to be added
   * @param options registration options
   */
  set<S extends keyof TSystem & string, TComponent, Scoped extends boolean = false>(
    name: S,
    component: TComponent,
    options?: { scoped?: Scoped },
  ): SystemicBuild<
    {
      [G in keyof TSystem]: G extends S
        ? IsComponent<TComponent> extends true
          ? { component: ComponentTypeOf<TComponent>; scoped: Scoped }
          : { component: TComponent; scoped: Scoped }
        : TSystem[G];
    },
    S,
    DependenciesOf<TComponent>
  >;

  /**
   * Adds a configuration to the system, which will be available as a scoped dependency named 'config'
   */
  configure<TComponent>(component: TComponent): SystemicBuild<
    TSystem & {
      config: IsComponent<TComponent> extends true
        ? { component: ComponentTypeOf<TComponent>; scoped: true }
        : { component: TComponent; scoped: true };
    },
    "config",
    DependenciesOf<TComponent>
  >;

  /**
   * Removes a component from the system.
   * Removing components during tests can decrease startup time.
   */
  remove<S extends string>(name: S): Systemic<Omit<TSystem, S>>;

  /**
   * Includes a subsystem into this systemic system
   */
  merge<TSubSystem extends Record<string, Registration>>(
    subSystem: Systemic<TSubSystem>,
    options?: { override?: boolean },
  ): Systemic<TSystem & TSubSystem>;

  /**
   * Includes a subsystem into this systemic system
   */
  include<TSubSystem extends Record<string, Registration>>(
    subSystem: Systemic<TSubSystem>,
    options?: { override?: boolean },
  ): Systemic<TSystem & TSubSystem>;

  /**
   * Starts the system and all of its components
   */
  start(): Promise<SystemOf<TSystem>>;

  /**
   * Stops the system and all of its components
   */
  stop(): Promise<void>;

  /**
   * Restarts the system and all of its components
   */
  restart(): Promise<SystemOf<TSystem>>;

  readonly _definitions: Map<string, Definition>;
}

export type DependsOn<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TDependencies extends Record<string, unknown>,
> = {
  /**
   * Specifies which other components the last added components depends on.
   * When name and type of the dependencies match those available in the system, the dependency can be added by name.
   * When a dependency is named differently in the system or only part of a component is required as a dependency, a MappingDependsOnOption can be used.
   */
  dependsOn: <const TNames extends DependsOnOption<Omit<TSystemic, TCurrent>>[]>(
    ...names: TNames
  ) => ValidateDependencies<TSystemic, TCurrent, TDependencies, TNames> extends [
    infer First extends DependencyValidationError<any, any, any>,
    ...any[],
  ]
    ? SystemicWithInvalidDependency<TCurrent, First>
    : SystemicBuild<
        TSystemic,
        TCurrent,
        StripEmptyObjectsRecursively<DeleteProps<TDependencies, DependencyDestinationsOf<TNames>>>
      >;
};

export type IncompleteSystemic<TCurrent extends string, TMissing> = {
  [X in keyof Systemic<any>]: (
    error: `Please add missing dependencies for component "${TCurrent}"`,
    expected: StripEmptyObjectsRecursively<DeepRequiredOnly<TMissing>>,
  ) => void;
};

export type SystemicWithInvalidDependency<
  TCurrent extends string,
  TError extends DependencyValidationError<any, any, any>,
> = {
  [X in keyof Systemic<any>]: (
    error: string extends TError[0]
      ? `Destination of a dependency for component "${TCurrent}" is unknown.`
      : `Dependency "${TError[0]}" on component "${TCurrent}" is not of the required type`,
    expected: TError[1],
    actual: TError[2],
  ) => void;
};

export type SystemicBuild<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TDependencies extends Record<string, unknown>,
> = [RequiredKeys<TDependencies>] extends [never]
  ? Systemic<TSystemic> & DependsOn<TSystemic, TCurrent, TDependencies>
  : DependsOn<TSystemic, TCurrent, TDependencies> & IncompleteSystemic<TCurrent, TDependencies>;

type SystemicBuildDefaultComponent<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
> = Systemic<TSystemic> & {
  /**
   * Specifies which other components the last added components depends on.
   * When name and type of the dependencies match those available in the system, the dependency can be added by name.
   * When a dependency is named differently in the system or only part of a component is required as a dependency, a MappingDependsOnOption can be used.
   */
  dependsOn: <const TNames extends DependsOnOption<Omit<TSystemic, TCurrent>>[]>(
    ...names: TNames
  ) => ValidateDependencies<TSystemic, TCurrent, EmptyObject, TNames> extends [
    infer First extends DependencyValidationError<any, any, any>,
    ...any[],
  ]
    ? SystemicWithInvalidDependency<TCurrent, First>
    : SystemicBuildDefaultComponent<
        {
          [G in keyof TSystemic]: G extends TCurrent
            ? {
                component: MergeIntoDefaultComponent<
                  TSystemic,
                  TCurrent,
                  TNames,
                  TSystemic[TCurrent]["component"]
                >;
                scoped: false;
              }
            : TSystemic[G];
        },
        TCurrent
      >;
};

type MergeIntoDefaultComponent<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TNames extends DependsOnOption<TSystemic>[],
  TComponent,
> = TNames extends [
  infer First extends DependsOnOption<TSystemic>,
  ...infer Rest extends DependsOnOption<TSystemic>[],
]
  ? MergeIntoDefaultComponent<
      TSystemic,
      TCurrent,
      Rest,
      SetNestedProp<
        TComponent,
        ToMappingDependsOnOption<First>["destination"],
        Injected<TSystemic, TCurrent, ToMappingDependsOnOption<First>>
      >
    >
  : TComponent;
