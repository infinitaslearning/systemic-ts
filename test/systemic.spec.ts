import { systemic } from "../src";
import type { EmptyObject, Systemic } from "../src/types";
import { mockComponent } from "./mocks/component-mock";
import { expectTypes } from "./test-helpers/type-matchers";
import type { DependsOn } from "../src/types/systemic";

describe("systemic", () => {
  it("starts without any components", async () => {
    const system = systemic();

    const components = await system.start();

    expect(components).toEqual({});
  });

  it("stops without any components", async () => {
    const system = systemic();

    await system.start();
    await system.stop();
  });

  it("stops without being started", async () => {
    const system = systemic();

    await system.stop();
  });

  it("starts a single component", async () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    const components = await system.start();

    expect(components).toEqual({ foo: "foo" });
    expect(foo.state).toEqual({ numberOfStarts: 1, isActive: true, dependencies: {} });
    expect(foo.start).toHaveBeenCalledTimes(1);
    expect(foo.stop).not.toHaveBeenCalled();
  });

  it("stops a single component after being started", async () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    await system.start();
    await system.stop();

    expect(foo.state).toEqual({ numberOfStarts: 1, isActive: false, dependencies: {} });
    expect(foo.start).toHaveBeenCalledTimes(1);
    expect(foo.stop).toHaveBeenCalledTimes(1);
  });

  it("does not stop a single component if it was not started", async () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    await system.stop();

    expect(foo.state).toEqual({ numberOfStarts: 0, isActive: false, dependencies: undefined });
    expect(foo.start).not.toHaveBeenCalled();
    expect(foo.stop).not.toHaveBeenCalled();
  });

  it("restarts a single component", async () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    await system.start();

    expect(foo.state).toEqual({ numberOfStarts: 1, isActive: true, dependencies: {} });
    expect(foo.start).toHaveBeenCalledTimes(1);
    expect(foo.stop).not.toHaveBeenCalled();

    await system.restart();

    expect(foo.state).toEqual({ numberOfStarts: 2, isActive: true, dependencies: {} });
    expect(foo.start).toHaveBeenCalledTimes(2);
    expect(foo.stop).toHaveBeenCalledTimes(1);
  });

  it("includes object components without start method", async () => {
    const foo = { bar: 42 };
    const system = systemic().add("foo", foo);

    const components = await system.start();

    expect(components).toEqual({ foo });
  });

  it("includes synchronous components", async () => {
    const foo = { start: () => ({ bar: 42 }) };
    const system = systemic().add("foo", foo);

    const components = await system.start();

    expect(components).toEqual({ foo: { bar: 42 } });
  });

  it("includes a function component", async () => {
    const foo = () => ({ bar: 42 });
    const system = systemic().add("foo", foo);

    const components = await system.start();

    expect(components).toEqual({ foo: { bar: 42 } });
  });

  it("starts multiple components with dependencies", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    const components = await system.start();

    expect(components).toEqual({ foo: "foo", bar: "bar" });
    expect(foo.state).toEqual({ numberOfStarts: 1, isActive: true, dependencies: {} });
    expect(foo.start).toHaveBeenCalledTimes(1);
    expect(foo.stop).not.toHaveBeenCalled();
    expect(bar.state).toEqual({ numberOfStarts: 1, isActive: true, dependencies: { foo: "foo" } });
    expect(bar.start).toHaveBeenCalledTimes(1);
    expect(bar.stop).not.toHaveBeenCalled();
  });

  it("creates a default component from its dependencies", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).add("baz").dependsOn("foo", "bar");

    const components = await system.start();

    expect(components).toEqual({ foo: "foo", bar: "bar", baz: { foo: "foo", bar: "bar" } });
  });

  it("includes components from a different system", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const baz = mockComponent("baz");

    const otherSystem = systemic<{ foo: string }>().add("baz", baz).dependsOn("foo");
    const system = systemic<{ baz: string }>()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo", "baz")
      .include(otherSystem);

    const components = await system.start();

    expect(components).toEqual({ foo: "foo", bar: "bar", baz: "baz" });
    expect(foo.state.dependencies).toEqual({});
    expect(bar.state.dependencies).toEqual({ foo: "foo", baz: "baz" });
    expect(baz.state.dependencies).toEqual({ foo: "foo" });
  });

  it("merges the components from multiple systems", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const baz = mockComponent("baz");

    const otherSystem = systemic<{ foo: string }>().add("baz", baz).dependsOn("foo");
    const system = systemic<{ baz: string }>()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo", "baz")
      .merge(otherSystem);

    const components = await system.start();

    expect(components).toEqual({ foo: "foo", bar: "bar", baz: "baz" });
    expect(foo.state.dependencies).toEqual({});
    expect(bar.state.dependencies).toEqual({ foo: "foo", baz: "baz" });
    expect(baz.state.dependencies).toEqual({ foo: "foo" });
  });

  it("starts the components in the correct order", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const baz = mockComponent("baz");

    const otherSystem = systemic<{ foo: string }>().add("baz", baz).dependsOn("foo");
    const system = systemic<{ baz: string }>()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo", "baz")
      .include(otherSystem);

    await system.start();

    expect(foo.start.mock.invocationCallOrder[0]).toBeLessThan(
      baz.start.mock.invocationCallOrder[0],
    );
    expect(baz.start.mock.invocationCallOrder[0]).toBeLessThan(
      bar.start.mock.invocationCallOrder[0],
    );
  });

  it("stops the components in reverse order", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const baz = mockComponent("baz");

    const otherSystem = systemic<{ foo: string }>().add("baz", baz).dependsOn("foo");
    const system = systemic<{ baz: string }>()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo", "baz")
      .include(otherSystem);

    await system.start();
    await system.stop();

    expect(bar.stop.mock.invocationCallOrder[0]).toBeLessThan(baz.stop.mock.invocationCallOrder[0]);
    expect(baz.stop.mock.invocationCallOrder[0]).toBeLessThan(foo.stop.mock.invocationCallOrder[0]);
  });

  it("throws an error if a component fails to start", async () => {
    const foo = mockComponent("foo");
    foo.start.mockRejectedValue(new Error("Failed to start"));
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    await expect(system.start()).rejects.toThrowError("Failed to start");
    expect(bar.start).not.toHaveBeenCalled();
  });

  it("stops only the components that were started", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    bar.start.mockRejectedValue(new Error("Failed to start"));
    const baz = mockComponent("baz");
    const system = systemic()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo")
      .add("baz", baz)
      .dependsOn("bar");

    await expect(system.start()).rejects.toThrowError("Failed to start");
    await system.stop();

    expect(foo.stop).toHaveBeenCalledTimes(1);
    expect(bar.stop).not.toHaveBeenCalled();
    expect(baz.stop).not.toHaveBeenCalled();
  });

  it("rejects duplicate component names", () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    expect(() => system.add("foo" as any, foo)).toThrowError(
      'Component "foo" is already registered',
    );
  });

  it("rejects including a system with overlapping component names", () => {
    const foo = mockComponent("foo");
    const foo2 = mockComponent("foo2");

    const system = systemic().add("foo", foo);
    const otherSystem = systemic().add("foo", foo2);

    expect(() => system.include(otherSystem)).toThrowError('Component "foo" is already registered');
  });

  it('accepts including a system with overlapping component names if "override" is set to true', async () => {
    const foo = mockComponent("foo");
    const foo2 = mockComponent("foo2");

    const system = systemic().add("foo", foo);
    const otherSystem = systemic().add("foo", foo2);

    const mergedSystem = system.include(otherSystem, { override: true });

    const components = await mergedSystem.start();

    expect(components).toEqual({ foo: "foo2" });
  });

  it("support nested components", async () => {
    const foo = mockComponent("foo");
    const barBaz = mockComponent("bar.baz");
    const barQux = mockComponent("bar.qux");
    const baz = mockComponent("baz");

    const system = systemic()
      .add("foo", foo)
      .add("bar.baz", barBaz)
      .add("bar.qux", barQux)
      .add("baz", baz)
      .dependsOn("foo", "bar.baz", "bar.qux");

    const components = await system.start();

    expect(components).toEqual({
      foo: "foo",
      bar: {
        baz: "bar.baz",
        qux: "bar.qux",
      },
      baz: "baz",
    });
    expect(baz.state.dependencies).toEqual({ foo: "foo", bar: { baz: "bar.baz", qux: "bar.qux" } });
  });

  it("supports scoped components", async () => {
    const foo = { bar: { baz: "bar" }, qux: { corge: { grault: "garply" } } };
    const bar = mockComponent("bar");
    const quxCorge = mockComponent("qux.corge");

    const system = systemic()
      .add("foo", foo, { scoped: true })
      .add("bar", bar)
      .dependsOn("foo")
      .add("qux.corge", quxCorge)
      .dependsOn("foo");

    await system.start();

    expect(bar.state.dependencies).toEqual({ foo: { baz: "bar" } });
    expect(quxCorge.state.dependencies).toEqual({ foo: { grault: "garply" } });
  });

  it("scopes configuration component", async () => {
    const config = { foo: "bar" };
    const foo = mockComponent("foo");
    const system = systemic().configure(config).add("foo", foo).dependsOn("config");

    const components = await system.start();

    expect(components).toEqual({ config, foo: "foo" });
    expect(foo.state.dependencies).toEqual({ config: "bar" });
  });

  it("adds a dependency with a specified destination", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent<{ baz: string }>("bar");
    const system = systemic()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn({ component: "foo", destination: "baz" });

    await system.start();

    expect(bar.state.dependencies).toEqual({ baz: "foo" });
  });

  it("adds a dependency with an unexpected specified destination", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent<EmptyObject>("bar");
    const system = systemic()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn({ component: "foo", destination: "baz" });
    await system.start();
    expect(bar.state.dependencies).toEqual({ baz: "foo" });
  });

  it("adds a dependency with a specified destination to a default component", async () => {
    const foo = mockComponent("foo");
    const system = systemic()
      .add("foo", foo)
      .add("bar")
      .dependsOn({ component: "foo", destination: "baz" });
    const components = await system.start();
    expect(components).toEqual({ foo: "foo", bar: { baz: "foo" } });
  });

  it("adds a dependency with a specified source", async () => {
    const foo = { qux: "baz" };
    const bar = mockComponent<{ foo: string }>("bar");
    const system = systemic()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn({ component: "foo", source: "qux" });
    await system.start();
    expect(bar.state.dependencies).toEqual({ foo: "baz" });
  });

  it("adds the full scoped dependency when source is an empty string", async () => {
    const foo = { qux: "baz" };
    const bar = mockComponent<{ foo: { qux: string } }>("bar");
    const system = systemic()
      .add("foo", foo, { scoped: true })
      .add("bar", bar)
      .dependsOn({ component: "foo", source: "" });
    await system.start();
    expect(bar.state.dependencies).toEqual({ foo: { qux: "baz" } });
  });

  it("allows missing optional dependencies", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent<{ baz?: string }>("bar");
    const system = systemic<{ baz: string }>()
      .add("foo", foo)
      .add("bar", bar)
      .dependsOn("foo", { component: "baz", optional: true });

    const components = await system.start();

    expect(components).toEqual({ foo: "foo", bar: "bar" });
    expect(bar.state.dependencies).toEqual({ foo: "foo" });
  });

  it("removes a component from the system", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    const newSystem = system.remove("bar");

    const components = await newSystem.start();

    expectTypes<
      typeof newSystem,
      Systemic<{ foo: { component: string; scoped: false } }>
    >().toBeEqual();
    expect(components).toEqual({ foo: "foo" });
  });

  it("does not allow removing a component that does not exist", () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    expect(() => system.remove("bar")).toThrowError('Component "bar" is not registered');
  });

  it("does not allow removing a component that is a dependency of another component", () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    expect(() => system.remove("foo")).toThrowError('Component "foo" is a dependency of "bar"');
  });

  it("does not allow adding another dependency to the last component after removing a component", () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    const newSystem = system.remove("bar");

    expect(() => (newSystem as any).dependsOn("foo")).toThrowError(
      "You must add a component before calling dependsOn",
    );
  });

  it("replace a component in the system", async () => {
    const foo = mockComponent("foo");
    const bar = mockComponent("bar");
    const baz = mockComponent("baz");
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    const newSystem = system.set("bar", baz);

    const components = await newSystem.start();

    expect(components).toEqual({ foo: "foo", bar: "baz" });
  });

  it("replaces a component in the system with a scoped component", async () => {
    const foo = mockComponent("foo");
    const bar = { start: ({ foo }: { foo: string }) => foo };
    const baz = { bar: "baz" };
    const system = systemic().add("foo", foo).add("bar", bar).dependsOn("foo");

    const newSystem = system.set("foo", baz, { scoped: true });

    const components = await newSystem.start();

    type ExpectedSystem = {
      foo: { component: { bar: string }; scoped: true };
      bar: { component: string; scoped: false };
    };
    expectTypes<
      typeof newSystem,
      Systemic<ExpectedSystem> & DependsOn<ExpectedSystem, "foo", EmptyObject>
    >().toBeEqual();
    expect(components).toEqual({ foo: { bar: "baz" }, bar: "baz" });
  });

  it("does not start components that have already been started", async () => {
    const foo = mockComponent("foo");
    const system = systemic().add("foo", foo);

    const components = await system.start();

    const bar = mockComponent("bar");
    const newComponents = await system.add("bar", bar).start();

    expect(foo.start).toHaveBeenCalledTimes(1);
    expect(bar.start).toHaveBeenCalledTimes(1);
    expect(components).toEqual({ foo: "foo" });
    expect(newComponents).toEqual({ foo: "foo", bar: "bar" });
  });
});
