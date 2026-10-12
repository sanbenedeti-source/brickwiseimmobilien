export type CustomerRecord = {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  source: "Registration" | "Contact request" | "Funding";
  status: "New" | "Active";
  createdAt: string;
};

export function normalizeCustomerEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildCustomerId(email: string) {
  return normalizeCustomerEmail(email).replace(/[^a-z0-9]+/g, "-");
}

export function getKnownCustomersFromRequests(
  requests:
    | {
        created_at: string | null;
        name: string | null;
        full_name: string | null;
        email: string | null;
        phone: string | null;
      }[]
    | null
    | undefined
) {
  const customers = new Map<string, CustomerRecord>();

  for (const request of requests || []) {
    if (!request.email) continue;

    const email = normalizeCustomerEmail(request.email);

    if (!customers.has(email)) {
      customers.set(email, {
        id: buildCustomerId(email),
        fullName:
          request.name ||
          request.full_name ||
          request.email.split("@")[0] ||
          "Unknown customer",
        email,
        phone: request.phone || undefined,
        source: "Contact request",
        status: "Active",
        createdAt: request.created_at || new Date().toISOString(),
      });
    }
  }

  return Array.from(customers.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}

export function mergeCustomers(
  primary: CustomerRecord[],
  secondary: CustomerRecord[]
) {
  const customers = new Map<string, CustomerRecord>();

  for (const customer of [...primary, ...secondary]) {
    const email = normalizeCustomerEmail(customer.email);
    const existing = customers.get(email);

    if (!existing) {
      customers.set(email, customer);
      continue;
    }

    customers.set(email, {
      ...existing,
      fullName:
        existing.fullName !== "Unknown customer"
          ? existing.fullName
          : customer.fullName,
      phone: existing.phone || customer.phone,
      status: existing.status === "Active" ? "Active" : customer.status,
      createdAt:
        existing.createdAt < customer.createdAt
          ? existing.createdAt
          : customer.createdAt,
    });
  }

  return Array.from(customers.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
