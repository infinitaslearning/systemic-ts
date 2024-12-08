import type { Registration } from "./definition";
import type { PropAt } from "./util";

type SimpleDependsOnOption<TSystemic> = keyof TSystemic & string;
interface MappingDependsOnOption<TSystemic> {
  component: keyof TSystemic & string;
  destination?: string;
  optional?: boolean;
  source?: string;
}

export type DependsOnOption<TSystemic> =
  | SimpleDependsOnOption<TSystemic>
  | MappingDependsOnOption<TSystemic>;

type DependencyDestinationOf<TOption> = TOption extends {
  component: infer Component;
  destination?: infer Destination;
}
  ? unknown extends Destination
    ? Component
    : Destination
  : TOption extends PropertyKey
    ? TOption
    : never;

export type DependencyDestinationsOf<TOptions> = TOptions extends [infer First, ...infer Rest]
  ? [DependencyDestinationOf<First>, ...DependencyDestinationsOf<Rest>]
  : [];

export type ToMappingDependsOnOption<TOption extends DependsOnOption<any>> =
  TOption extends SimpleDependsOnOption<any>
    ? { component: TOption; destination: TOption }
    : TOption extends MappingDependsOnOption<any>
      ? OptionWithDestination<TOption>
      : never; // Impossible situation

type OptionWithDestination<TOption extends MappingDependsOnOption<any>> = Omit<
  TOption,
  "destination"
> & {
  destination: DependencyDestinationOf<TOption>;
};

export type ValidateDependencies<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TDependencies extends Record<string, unknown>,
  TGiven extends DependsOnOption<TSystemic>[],
> = TGiven extends [
  infer First extends DependsOnOption<TSystemic>,
  ...infer Rest extends DependsOnOption<TSystemic>[],
]
  ? [
      ...ValidateMappingDependency<
        TSystemic,
        TCurrent,
        TDependencies,
        ToMappingDependsOnOption<First>
      >,
      ...ValidateDependencies<TSystemic, TCurrent, TDependencies, Rest>,
    ]
  : [];

type ValidateMappingDependency<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TDependencies extends Record<string, unknown>,
  TMapping extends { component: string; destination: string; source?: string },
> = IsDestinationOrSourceUnbound<TMapping> extends true
  ? [DependencyValidationError<string, unknown, unknown>] // Dependency cannot be determined
  : [PropAt<TDependencies, DependencyDestinationOf<TMapping>>] extends [never]
    ? [] // Unexpected dependency
    : [Injected<TSystemic, TCurrent, TMapping>] extends [
          PropAt<TDependencies, DependencyDestinationOf<TMapping>>,
        ]
      ? [] // Correct dependency
      : [
          DependencyValidationError<
            DependencyDestinationOf<TMapping>,
            PropAt<TDependencies, DependencyDestinationOf<TMapping>>,
            Injected<TSystemic, TCurrent, TMapping>
          >,
        ]; // Wrong type

type IsDestinationOrSourceUnbound<
  TMapping extends { component: string; destination: string; source?: string },
> = string extends TMapping["destination"]
  ? true
  : undefined extends TMapping["source"]
    ? false
    : string extends TMapping["source"]
      ? true
      : false;

export type Injected<
  TSystemic extends Record<string, Registration<unknown, boolean>>,
  TCurrent extends keyof TSystemic & string,
  TMapping extends { component: string; destination: string; source?: string },
> = NeverToUndefined<
  PropAt<
    TSystemic[TMapping["component"]]["component"],
    OptionSource<TSystemic[TMapping["component"]], TCurrent, TMapping["source"]>
  >
>;

type NeverToUndefined<T> = [T] extends [never] ? undefined : T;

type OptionSource<
  TRegistration extends Registration<unknown, boolean>,
  TCurrent extends string,
  TGiven extends string | undefined,
> = TGiven extends string
  ? TGiven extends ""
    ? undefined
    : TGiven
  : TRegistration["scoped"] extends true
    ? TCurrent
    : undefined;

export type DependencyValidationError<TName extends string, TExpected, TActual> = [
  TName,
  TExpected,
  TActual,
];
