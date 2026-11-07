"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  useAuth,
  isProfileComplete,
  isProfileStatusIncomplete,
} from "@/lib/auth-context";
import {
  getCurrentUser,
  sendVerificationCode,
  watchEmailOtpDelivery,
} from "@/lib/api";
// Google 登录已撤销；恢复时取消下一行 import 注释。
// import { signInWithGoogle } from "@/lib/api";
import {
  beginProfileSetupLoginIntent,
  canContinueProfileSetup,
  clearProfileSetupState,
  markProfileSetupPending,
} from "@/lib/profile-setup-session";

import { toast } from "sonner";

import { AlertCircle, Info } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// Google 登录已撤销；恢复时取消下一行 import 注释。
// import { Separator } from "@/components/ui/separator";

function getAuthActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    if (
      error.message.includes("smtp") ||
      error.message.includes("auth") ||
      error.message.includes("535") ||
      error.message.includes("invalid login") ||
      error.message.includes("Could not connect") ||
      error.message.includes("ECONNECTION")
    ) {
      return "邮件服务暂时不可用，请稍后重试";
    }
    if (error.message.includes("invalid") || error.message.includes("expired")) {
      return "验证码错误或已过期";
    }
  }
  return fallback;
}

function normalizeNextPath(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}

function resolvePostAuthDestination(
  nextPath: string | null,
  currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
) {
  if (nextPath && isProfileComplete(currentUser)) {
    return nextPath;
  }
  return isProfileComplete(currentUser) ? "/" : "/setup";
}

/* ── countdown hook ── */

function useCountdown(seconds = 60) {
  const [remaining, setRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (remaining > 0) return;
    setRemaining(seconds);
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [remaining, seconds]);

  const reset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRemaining(0);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { remaining, start, reset };
}

/* ── logo ── */

function LogoIcon({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon.svg"
      alt="ParlaSoul"
      className={className}
      width={28}
      height={28}
    />
  );
}

/* Google 登录已撤销；恢复时取消整段注释。
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}
*/

/* ── fallback ── */

function LoginPageFallback() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header className="px-10 py-7 flex items-center gap-2.5">
        <LogoIcon className="size-7 rounded-lg" />
        <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
      </main>
    </div>
  );
}

/* ── main content ── */

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const countdown = useCountdown(60);
  const deliveryWatchRef = useRef<AbortController | null>(null);
  const {
    login,
    logout,
    refreshUser,
    user,
    isLoading: isAuthLoading,
    profileStatus,
  } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = normalizeNextPath(searchParams.get("next"));

  useEffect(() => {
    return () => {
      deliveryWatchRef.current?.abort();
    };
  }, []);

  /* redirect if already logged in */
  useEffect(() => {
    if (isAuthLoading || !user || profileStatus !== "loaded") return;

    if (isProfileStatusIncomplete(profileStatus, user)) {
      if (canContinueProfileSetup(user.id)) {
        markProfileSetupPending(user.id);
        router.replace("/setup");
        return;
      }

      void logout().finally(() => {
        clearProfileSetupState();
        router.replace("/login");
      });
      return;
    }

    clearProfileSetupState();
    router.replace(resolvePostAuthDestination(nextPath, user));
  }, [user, isAuthLoading, profileStatus, nextPath, router, logout]);

  /* post-login redirect */
  const handlePostLoginRedirect = async () => {
    let currentUser = user;
    let didLoadBackendProfile = false;
    try {
      await refreshUser();
    } catch (e) {
      toast.error("用户信息同步失败，请稍后重试");
      console.error(e);
    }
    try {
      const backendUser = await getCurrentUser();
      if (backendUser) {
        currentUser = backendUser;
        didLoadBackendProfile = true;
      }
    } catch (e) {
      toast.error("账号资料加载失败，请检查网络后重试");
      console.error(e);
    }
    if (!currentUser) {
      beginProfileSetupLoginIntent();
    } else if (!didLoadBackendProfile) {
      clearProfileSetupState();
      setError("账号资料加载失败，请重试");
      return;
    } else if (!isProfileComplete(currentUser)) {
      markProfileSetupPending(currentUser.id);
    } else {
      clearProfileSetupState();
    }
    router.replace(resolvePostAuthDestination(nextPath, currentUser));
  };

  /* send verification code */
  const handleSendCode = async () => {
    if (!email.trim() || isSendingCode) return;
    setError("");
    setInfo("");
    setIsSendingCode(true);
    deliveryWatchRef.current?.abort();
    try {
      await sendVerificationCode(email);
      countdown.start();

      const controller = new AbortController();
      deliveryWatchRef.current = controller;
      void watchEmailOtpDelivery(email, { signal: controller.signal }).then(
        (result) => {
          if (result.outcome !== "failed" || controller.signal.aborted) return;
          countdown.reset();
          setError(result.message);
        },
      );
    } catch (err) {
      setError(getAuthActionErrorMessage(err, "验证码发送失败，请稍后重试"));
    } finally {
      setIsSendingCode(false);
    }
  };

  /* otp login */
  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setInfo("");
    setIsLoading(true);
    beginProfileSetupLoginIntent();
    try {
      await login(email, code);
      await handlePostLoginRedirect();
    } catch (err) {
      clearProfileSetupState();
      setError(getAuthActionErrorMessage(err, "验证码错误或已过期"));
    } finally {
      setIsLoading(false);
    }
  };

  /* Google 登录已撤销；恢复时取消整段注释。
  const handleGoogleLogin = async () => {
    setError("");
    setInfo("");
    setIsLoading(true);
    beginProfileSetupLoginIntent();
    try {
      await signInWithGoogle(nextPath || "/");
    } catch (err) {
      clearProfileSetupState();
      setError(getAuthActionErrorMessage(err, "Google 登录发起失败"));
      setIsLoading(false);
    }
  };
  */

  /* ── render ── */
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header */}
      <header className="px-10 py-7 flex items-center gap-2.5 max-sm:px-6 max-sm:py-5">
        <LogoIcon className="size-7 rounded-lg" />
        <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 pb-16 max-sm:px-5 max-sm:pb-12">
        <div className="w-full max-w-[400px]">
          <h1 className="text-[32px] font-bold tracking-tight leading-tight max-sm:text-[26px]">
            Welcome to ParlaSoul
          </h1>
          <p className="mt-2.5 mb-9 text-[15px] text-gray-400 leading-relaxed">
            Sign in to your account to continue
          </p>

          {/* Error / Info */}
          {error && (
            <Alert className="mb-5 items-center gap-x-1.5 border-0 bg-transparent p-0 text-[13px] leading-5 text-red-600 [&>svg]:translate-y-0">
              <AlertCircle className="size-3.5" />
              <AlertDescription className="text-[13px] leading-5 text-red-600">
                {error}
              </AlertDescription>
            </Alert>
          )}
          {!error && info && (
            <Alert className="mb-5 items-center gap-x-1.5 border-0 bg-transparent p-0 text-[13px] leading-5 text-gray-500 [&>svg]:translate-y-0">
              <Info className="size-3.5" />
              <AlertDescription className="text-[13px] leading-5 text-gray-500">
                {info}
              </AlertDescription>
            </Alert>
          )}

          {/* ── Email code form ── */}
          <form onSubmit={handleOtpLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email-code">Email address</Label>
              <Input
                id="email-code"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                disabled={isLoading || isSendingCode}
                className="h-12 rounded-lg border-gray-200 bg-white text-[15px] focus-visible:border-gray-400 focus-visible:ring-0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Verification code</Label>
              <div className="flex gap-3 max-sm:flex-col">
                <Input
                  id="code"
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  disabled={isLoading || isSendingCode}
                  className="h-12 rounded-lg border-gray-200 bg-white text-[15px] focus-visible:border-gray-400 focus-visible:ring-0"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={isLoading || isSendingCode || countdown.remaining > 0}
                  onClick={handleSendCode}
                  className="h-12 shrink-0 rounded-lg border-gray-200 px-5 text-[13px] font-medium text-gray-500 hover:border-gray-400 hover:text-black max-sm:w-full"
                >
                  {isSendingCode
                    ? "Sending..."
                    : countdown.remaining > 0
                      ? `Resend in ${countdown.remaining}s`
                      : "Send code"}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="h-12 w-full rounded-lg bg-black text-[15px] font-semibold text-white hover:bg-gray-800"
            >
              {isLoading ? "Verifying..." : "Continue with email"}
            </Button>
            <p className="mt-3 text-center text-xs text-gray-400">
              Can&apos;t find the code? Check your spam or junk folder.
            </p>
          </form>

          {/* Google 登录已撤销；恢复时取消整段注释。
          <div className="my-5 flex items-center gap-4">
            <Separator className="flex-1 bg-gray-100" />
            <span className="text-xs text-gray-300">or</span>
            <Separator className="flex-1 bg-gray-100" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleLogin}
            disabled={isLoading}
            className="h-12 w-full rounded-lg border-gray-200 bg-white text-[14px] font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            <GoogleIcon />
            Continue with Google
          </Button>
          */}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-10 pb-7 text-center max-sm:px-6">
        <p className="text-xs text-gray-300">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-gray-400 underline underline-offset-2 hover:text-gray-500">Terms of Use</a>
          {" "}and{" "}
          <a href="/privacy" className="text-gray-400 underline underline-offset-2 hover:text-gray-500">Privacy Policy</a>
        </p>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
