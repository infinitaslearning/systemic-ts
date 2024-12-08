import type { EmptyObject, Systemic } from "../../src/types";
import type {
  DependsOn,
  IncompleteSystemic,
  SystemicWithInvalidDependency,
} from "../../src/types/systemic";
import { mockSystemic } from "../mocks/systemic-mock";
import { expectTypes } from "../test-helpers/type-matchers";

describe("systemic types", () => {
  it("is a systemic with a single component", () => {
    const system = mockSystemic().add("foo", {
      start: async (deps: EmptyObject) => ({ foo: "bar" }),
    });

    type Registrations = { foo: { component: { foo: string }; scoped: false } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a single scoped component", () => {
    const system = mockSystemic().add(
      "foo",
      { start: async (deps: EmptyObject) => ({ foo: "bar" }) },
      { scoped: true },
    );

    type Registrations = { foo: { component: { foo: string }; scoped: true } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a single synchronous component", () => {
    const system = mockSystemic().add("foo", { start: (deps: EmptyObject) => ({ foo: "bar" }) });

    type Registrations = { foo: { component: { foo: string }; scoped: false } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a single function component", () => {
    const system = mockSystemic().add("foo", () => ({ foo: "bar" }));

    type Registrations = { foo: { component: { foo: string }; scoped: false } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with multiple components", () => {
    const system = mockSystemic()
      .add("foo", { start: (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar", { start: async (deps: { foo: { foo: string } }) => 42 })
      .dependsOn("foo")
      .add("baz", (dep: { bar: number }) => ({ baz: dep.bar }))
      .dependsOn("bar");

    type Registrations = {
      foo: { component: { foo: string }; scoped: false };
      bar: { component: number; scoped: false };
      baz: { component: { baz: number }; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "baz", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a default component", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar")
      .dependsOn("foo")
      .add("baz", { start: async (deps: EmptyObject) => ({ baz: 42 }) });

    type Registrations = {
      foo: { component: { foo: string }; scoped: false };
      bar: { component: { foo: { foo: string } }; scoped: false };
      baz: { component: { baz: number }; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "baz", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a simple object as component", () => {
    const system = mockSystemic().add("foo", { foo: { bar: 42 } });

    type Registrations = { foo: { component: { foo: { bar: number } }; scoped: false } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a scoped dependency", () => {
    const system = mockSystemic()
      .add(
        "foo",
        { start: async (deps: EmptyObject) => ({ foo: "bar", bar: { baz: "qux" } }) },
        { scoped: true },
      )
      .add("bar", { start: async (deps: { foo: { baz: string } }) => 42 })
      .dependsOn("foo");

    type Registrations = {
      foo: { component: { foo: string; bar: { baz: string } }; scoped: true };
      bar: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "bar", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a missing dependency", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar", { start: async (deps: { foo: { foo: string } }) => 42 });

    type Registrations = {
      foo: { component: { foo: string }; scoped: false };
      bar: { component: number; scoped: false };
    };
    type Expected = IncompleteSystemic<"bar", { foo: { foo: string } }> &
      DependsOn<Registrations, "bar", { foo: { foo: string } }>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a missing scoped dependency", () => {
    const system = mockSystemic()
      .add(
        "foo",
        { start: async (deps: EmptyObject) => ({ foo: "bar", bar: { baz: "qux" } }) },
        { scoped: true },
      )
      .add("bar", { start: async (deps: { foo: { baz: string } }) => 42 });

    type Registrations = {
      foo: { component: { foo: string; bar: { baz: string } }; scoped: true };
      bar: { component: number; scoped: false };
    };
    type Expected = IncompleteSystemic<"bar", { foo: { baz: string } }> &
      DependsOn<Registrations, "bar", { foo: { baz: string } }>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with an invalid dependency", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar", { start: async (deps: { foo: { foo: number } }) => 42 })
      .dependsOn("foo");

    type Expected = SystemicWithInvalidDependency<"bar", ["foo", { foo: number }, { foo: string }]>;

    expectTypes<typeof system, Expected>().toBeEqual();
    expectTypes<
      (typeof system)["start"],
      (
        error: 'Dependency "foo" on component "bar" is not of the required type',
        expected: { foo: number },
        actual: { foo: string },
      ) => void
    >().toBeEqual();
  });

  it("is a systemic with a nested component", () => {
    const system = mockSystemic().add("foo.bar", {
      start: async (deps: EmptyObject) => ({ baz: { bar: 42 } }),
    });

    type Registrations = { "foo.bar": { component: { baz: { bar: number } }; scoped: false } };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo.bar", EmptyObject>;
    type ExpectedSystem = { foo: { bar: { baz: { bar: number } } } };

    expectTypes<typeof system, Expected>().toBeEqual();
    expectTypes<Awaited<ReturnType<(typeof system)["start"]>>, ExpectedSystem>().toBeEqual();
  });

  it("is a systemic with a nested component with a scoped dependency", () => {
    const system = mockSystemic()
      .add(
        "baz",
        { start: async (deps: EmptyObject) => ({ foo: { bar: { qux: 42 } } }) },
        { scoped: true },
      )
      .add("foo.bar", { start: async (deps: { baz: { qux: number } }) => 42 })
      .dependsOn("baz");

    type Registrations = {
      baz: { component: { foo: { bar: { qux: number } } }; scoped: true };
      "foo.bar": { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "foo.bar", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a nested component with an invalid scoped dependency", () => {
    const system = mockSystemic()
      .add(
        "baz",
        { start: async (deps: EmptyObject) => ({ foo: { bar: { qux: 42 } } }) },
        { scoped: true },
      )
      .add("foo.bar", { start: async (deps: { baz: { qux: string } }) => 42 })
      .dependsOn("baz");

    type Registrations = {
      baz: { component: { foo: { bar: { qux: number } } }; scoped: true };
      "foo.bar": { component: number; scoped: false };
    };
    type Expected = SystemicWithInvalidDependency<
      "foo.bar",
      ["baz", { qux: string }, { qux: number }]
    >;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a nested component used as a dependency", () => {
    const system = mockSystemic()
      .add("foo.bar", { start: async (deps: EmptyObject) => ({ baz: 42 }) })
      .add("qux", { start: async (deps: { foo: { bar: { baz: number } } }) => 42 })
      .dependsOn("foo.bar");

    type Registrations = {
      "foo.bar": { component: { baz: number }; scoped: false };
      qux: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "qux", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a partially fullfilled nested dependency", () => {
    const system = mockSystemic()
      .add("foo.bar", { start: async (deps: EmptyObject) => ({ baz: 42 }) })
      .add("qux", {
        start: async (deps: { foo: { bar: { baz: number }; baz: { quux: string } } }) => 42,
      })
      .dependsOn("foo.bar");

    type Registrations = {
      "foo.bar": { component: { baz: number }; scoped: false };
      qux: { component: number; scoped: false };
    };
    type Expected = IncompleteSystemic<"qux", { foo: { baz: { quux: number } } }> &
      DependsOn<Registrations, "qux", { foo: { baz: { quux: number } } }>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with an invalid nested dependency", () => {
    const system = mockSystemic()
      .add("foo.bar", { start: async (deps: EmptyObject) => ({ baz: 42 }) })
      .add("qux", { start: async (deps: { foo: { bar: { baz: string } } }) => 42 })
      .dependsOn("foo.bar");

    type Registrations = {
      "foo.bar": { component: { baz: number }; scoped: false };
      qux: { component: number; scoped: false };
    };
    type Expected = SystemicWithInvalidDependency<
      "qux",
      ["foo.bar", { baz: string }, { baz: number }]
    >;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a default component with a nested dependency", () => {
    const system = mockSystemic()
      .add("foo.bar", { start: async (deps: EmptyObject) => ({ baz: 42 }) })
      .add("qux")
      .dependsOn("foo.bar")
      .add("baz", { start: async (deps: EmptyObject) => ({ qux: 42 }) });

    type Registrations = {
      "foo.bar": { component: { baz: number }; scoped: false };
      qux: { component: { foo: { bar: { baz: number } } }; scoped: false };
      baz: { component: { qux: number }; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "baz", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a component with a dependency with a specified source", () => {
    const system = mockSystemic()
      .add("foo.bar", { start: async (deps: EmptyObject) => ({ baz: 42 }) })
      .add("qux", { start: async (deps: { baz: { baz: number } }) => 42 })
      .dependsOn({ component: "foo.bar", destination: "baz" });

    type Registrations = {
      "foo.bar": { component: { baz: number }; scoped: false };
      qux: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "qux", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a component with a scoped dependency with root as source", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ baz: "qux" }) }, { scoped: true })
      .add("bar", { start: async (deps: { foo: { baz: string } }) => 42 })
      .dependsOn({ component: "foo", source: "" });

    type Registrations = {
      foo: { component: { baz: string }; scoped: true };
      bar: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "bar", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with a component with a scoped dependency with non existing prop as source", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ baz: "qux" }) }, { scoped: true })
      .add("bar", { start: async (deps: { foo: { baz: string } }) => 42 })
      .dependsOn({ component: "foo", source: "test123" });

    type Registrations = {
      foo: { component: { baz: string }; scoped: true };
      bar: { component: number; scoped: false };
    };
    type Expected = SystemicWithInvalidDependency<"bar", ["foo", { baz: string }, undefined]>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with an injected dependency that extends the expected type", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar", { start: async (deps: { foo?: { foo?: string } }) => 42 })
      .dependsOn("foo");

    type Registrations = {
      foo: { component: { foo: string }; scoped: false };
      bar: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> &
      DependsOn<Registrations, "bar", { foo?: { foo: string } }>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });

  it("is a systemic with an unexpected dependency", () => {
    const system = mockSystemic()
      .add("foo", { start: async (deps: EmptyObject) => ({ foo: "bar" }) })
      .add("bar", { start: async (deps: EmptyObject) => 42 })
      .dependsOn("foo");

    type Registrations = {
      foo: { component: { foo: string }; scoped: false };
      bar: { component: number; scoped: false };
    };
    type Expected = Systemic<Registrations> & DependsOn<Registrations, "bar", EmptyObject>;

    expectTypes<typeof system, Expected>().toBeEqual();
  });
});
