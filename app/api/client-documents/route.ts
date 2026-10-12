import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getRequestLocale } from "@/app/lib/i18n";
import { apiCopy } from "@/app/lib/api-copy";

const bucketName = "client-documents";
const maxFileSize = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const copy = apiCopy[getRequestLocale(request)];
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: copy.authentication }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: copy.selectPdf }, { status: 400 });
  }

  if (file.type !== "application/pdf" || file.size === 0 || file.size > maxFileSize) {
    return NextResponse.json({ error: copy.pdfSize }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const signature = new TextDecoder().decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    return NextResponse.json({ error: copy.invalidPdf }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: copy.storageUnavailable }, { status: 503 });
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { error: bucketError } = await admin.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: maxFileSize,
    allowedMimeTypes: ["application/pdf"],
  });

  if (bucketError && !bucketError.message.toLowerCase().includes("already exists")) {
    return NextResponse.json({ error: copy.storageUnavailable }, { status: 500 });
  }

  const path = `${user.id}/signed-cooperation-agreement.pdf`;
  const { error: uploadError } = await admin.storage
    .from(bucketName)
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: copy.uploadFailed }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
