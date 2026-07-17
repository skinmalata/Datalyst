import { render, screen } from "@testing-library/react";
import { AuthGuard } from "@/components/AuthGuard";
import { useAuthStore } from "@/store/authStore";
beforeEach(() => useAuthStore.setState({ ready: true, authenticated: false, error: null }));
test("shows an actionable retry state after workspace setup fails", () => { useAuthStore.setState({ error: "The workspace service took too long to respond." }); render(<AuthGuard><div>Workspace</div></AuthGuard>); expect(screen.getByText("Workspace setup needs attention")).toBeTruthy(); expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy(); });
