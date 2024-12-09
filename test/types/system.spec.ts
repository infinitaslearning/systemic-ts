import type { Registration, RegistrationsOf, Systemic, SystemOf, TypeOf } from "../../src/types";
import { expectTypes } from "../test-helpers/type-matchers";

describe("system types", () => {
  describe("SystemOf", () => {
    it("is the type of the system defined by the given definition", () => {
      type Definition = {
        foo: Registration<{ foo: string }>;
        bar: Registration<number>;
        "baz.qux": Registration<{ qux: boolean }>;
        "baz.quux": Registration<string>;
      };

      type System = SystemOf<Definition>;

      expectTypes<
        System,
        { foo: { foo: string }; bar: number; baz: { qux: { qux: boolean }; quux: string } }
      >().toBeEqual();
    });
  });

  describe("RegistrationsOf", () => {
    it("extracts the registration type from a Systemic type", () => {
      type Definition = {
        foo: Registration<{ foo: string }>;
        bar: Registration<number>;
        "baz.qux": Registration<{ qux: boolean }>;
        "baz.quux": Registration<string>;
      };

      type System = Systemic<Definition>;

      expectTypes<RegistrationsOf<System>, Definition>().toBeEqual();
    });
  });

  describe("TypeOf", () => {
    it("extracts the component types from a Systemic type", () => {
      type Definition = {
        foo: Registration<{ foo: string }>;
        bar: Registration<number>;
        "baz.qux": Registration<{ qux: boolean }>;
        "baz.quux": Registration<string>;
      };

      type System = Systemic<Definition>;

      expectTypes<
        TypeOf<System>,
        { foo: { foo: string }; bar: number; baz: { qux: { qux: boolean }; quux: string } }
      >().toBeEqual();
    });
  });
});
