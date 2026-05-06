export function getHomeRouteByRole(role?: string | null): "/admin/dashboard" | "/barber/dashboard" | "/user/home" {
  const normalizedRole = (role || "student").trim().toLowerCase();

  if (normalizedRole === "admin") {
    return "/admin/dashboard";
  }

  if (normalizedRole === "barber") {
    return "/barber/dashboard";
  }

  return "/user/home";
}
