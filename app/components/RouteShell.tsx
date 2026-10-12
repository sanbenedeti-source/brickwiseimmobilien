"use client";

import { usePathname } from "next/navigation";

const wrappedClientPaths = [
  "/insights",
  "/about",
  "/real-estate-investing",
  "/mortgage",
  "/mortgage-calculator",
  "/thank-you",
];

export default function RouteShell({
  children,
  header,
  footer,
  sidebar,
  isAuthenticated,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  footer: React.ReactNode;
  sidebar: React.ReactNode;
  isAuthenticated: boolean;
}) {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard";
  const isAdminPortal = pathname === "/admin" || pathname.startsWith("/admin/");
  const isAuthenticatedProperty =
    isAuthenticated && pathname.startsWith("/properties/");
  const isAuthenticatedPropertyIndex =
    isAuthenticated && pathname === "/properties";
  const isStandalonePortalPage =
    isAuthenticated && (pathname === "/funding" || pathname === "/risk");
  const isWrappedClientPage =
    isAuthenticated &&
    (isAuthenticatedPropertyIndex ||
      wrappedClientPaths.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
      ));
  const hidesPublicChrome =
    isDashboard ||
    isAdminPortal ||
    isAuthenticatedProperty ||
    isAuthenticatedPropertyIndex ||
    isStandalonePortalPage ||
    isWrappedClientPage;

  return (
    <>
      {!hidesPublicChrome && header}
      {isWrappedClientPage ? (
        <>
          {sidebar}
          <div className="pt-16 lg:ml-[282px] lg:pt-0">{children}</div>
        </>
      ) : (
        children
      )}
      {!hidesPublicChrome && footer}
    </>
  );
}
