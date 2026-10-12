const fields = ["first_name", "last_name", "date_of_birth", "gender", "phone", "country"] as const;
export type ProfileFields = Record<(typeof fields)[number], string>;

export function readProfileFields(metadata: Record<string, unknown>): ProfileFields {
  const text = (key: string) => typeof metadata[key] === "string" ? metadata[key] as string : "";
  const names = text("full_name").trim().split(/\s+/);
  return {
    first_name: text("first_name") || names[0] || "",
    last_name: text("last_name") || names.slice(1).join(" "),
    date_of_birth: text("date_of_birth"), gender: text("gender"),
    phone: text("phone"), country: text("country"),
  };
}

// Omitted and unchanged fields must never overwrite saved metadata.
export function profilePatch(initial: ProfileFields, form: FormData): Record<string, string> {
  const patch: Record<string, string> = {};
  for (const field of fields) {
    const value = form.get(field);
    if (typeof value === "string" && value.trim() !== initial[field].trim()) patch[field] = value.trim();
  }
  if ("first_name" in patch || "last_name" in patch) {
    patch.full_name = `${patch.first_name ?? initial.first_name} ${patch.last_name ?? initial.last_name}`.trim();
  }
  return patch;
}
