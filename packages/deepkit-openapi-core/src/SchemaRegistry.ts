import {
  isPrimitive,
  isSameType,
  metaAnnotation,
  ReflectionKind,
  stringifyType,
  Type,
  TypeClass,
  TypeLiteral,
  TypeObjectLiteral,
} from "@deepkit/type";
import camelcase from "camelcase";
import { DeepKitOpenApiNameConflict } from "./errors";
import { Schema } from "./types";

export interface SchemeEntry {
  name: string;
  schema: Schema;
  type: Type;
}

export class SchemaRegistry {
  store: Map<string, SchemeEntry> = new Map();

  getClassOrObjectLiteralKey(t: TypeClass | TypeObjectLiteral): string {
    const nameAnnotation = metaAnnotation
      .getAnnotations(t)
      .find((t) => t.name === "openapi");

    // Handle user preferred name
    if (
      nameAnnotation?.options[0]?.kind === ReflectionKind.literal &&
      nameAnnotation?.options[0].literal === "name"
    ) {
      return (nameAnnotation?.options[1] as TypeLiteral).literal as string;
    }

    const rootName =
      t.kind === ReflectionKind.class ? t.classType.name : t.typeName ?? "";

    const args =
      t.kind === ReflectionKind.class
        ? t.arguments ?? []
        : t.typeArguments ?? [];

    return camelcase([rootName, ...args.map((a) => this.getTypeKey(a))], {
      pascalCase: true,
    });
  }

  getTypeKey(t: Type): string {
    if (isPrimitive(t)) {
      return stringifyType(t);
    } else if (
      t.kind === ReflectionKind.class ||
      t.kind === ReflectionKind.objectLiteral
    ) {
      return this.getClassOrObjectLiteralKey(t);
    } else if (t.kind === ReflectionKind.array) {
      return camelcase([this.getTypeKey(t.type), "Array"], {
        pascalCase: false,
      });
    } else {
      // Complex types not named
      return "";
    }
  }

  registerSchema(name: string, type: Type, schema: Schema) {
    const currentEntry = this.store.get(name);

    if (currentEntry && !isSameType(type, currentEntry?.type)) {
      throw new DeepKitOpenApiNameConflict(type, currentEntry.type, name);
    }

    this.store.set(name, { type, schema, name });
    schema.__registryKey = name;
  }
}
