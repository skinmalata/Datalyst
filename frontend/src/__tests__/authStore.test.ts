import { useAuthStore } from "@/store/authStore";
beforeEach(() => useAuthStore.getState().clear());
test("records an authenticated session with its organization", () => { useAuthStore.getState().setSession("token", "organization"); expect(useAuthStore.getState()).toMatchObject({ authenticated: true, token: "token", organizationId: "organization", error: null }); });
test("clears sensitive session state on logout", () => { useAuthStore.getState().setSession("token", "organization"); useAuthStore.getState().clear(); expect(useAuthStore.getState()).toMatchObject({ authenticated: false, token: "", organizationId: "" }); });
