"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DemoPanel from "@/components/login/DemoPanel";

import { useAuth } from "@/lib/auth-context";
import { markBrowserTourCompleted } from "@/lib/onboarding/tour-storage";
import {
  peekResumeCharacterId,
  takeResumeCharacterId,
} from "@/lib/pending-chat";
import {
  getCurrentUser,
  sendVerificationCode,
  watchEmailOtpDelivery,
} from "@/lib/api";

import { toast } from "sonner";

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

/* ── fallback ── */

function LoginPageFallback() {
  return (
    <div className="grid min-h-screen bg-white lg:h-screen lg:overflow-hidden lg:grid-cols-[minmax(0,1fr)_28rem]">
      <div className="hidden border-r border-border bg-white lg:block" />
      <div className="flex min-h-screen flex-col lg:min-h-0">
        <header className="flex items-center gap-2.5 px-6 py-7 max-sm:py-5">
          <LogoIcon className="size-7 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
        </header>
        <main className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="size-8 animate-spin rounded-full border-2 border-gray-200 border-t-black" />
        </main>
      </div>
    </div>
  );
}

/* ── main content ── */

function LoginPageContent() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);

  const countdown = useCountdown(60);
  const deliveryWatchRef = useRef<AbortController | null>(null);
  const { login, refreshUser, user, isLoading: isAuthLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = normalizeNextPath(searchParams.get("next"));
  // OTP 登录过程中的跳转统一由 handlePostLoginRedirect 负责，避免和下面的
  // 「已登录重定向」effect 互相覆盖（登录成功后两者会同时触发）。
  const redirectHandledRef = useRef(false);

  useEffect(() => {
    return () => {
      deliveryWatchRef.current?.abort();
    };
  }, []);

  /* redirect if already logged in */
  useEffect(() => {
    if (redirectHandledRef.current) return;
    if (isAuthLoading || !user) return;

    // 会话还在时点角色也会落到登录页，这条路径同样视为导览已完成。
    // handleOtpLogin 里也会标记，覆盖新输入验证码的路径。
    if (peekResumeCharacterId()) {
      markBrowserTourCompleted();
    }

    router.replace(nextPath ?? "/");
  }, [user, isAuthLoading, nextPath, router]);

  /* post-login redirect */
  const handlePostLoginRedirect = async () => {
    try {
      await refreshUser();
    } catch (e) {
      // 资料刷新失败不阻塞登录，下面的 getCurrentUser 会再确认一次后端会话。
      toast.error("用户信息同步失败，请稍后重试");
      console.error(e);
    }

    let currentUser: Awaited<ReturnType<typeof getCurrentUser>> = null;
    try {
      currentUser = await getCurrentUser();
    } catch (e) {
      toast.error("账号资料加载失败，请检查网络后重试");
      console.error(e);
    }
    if (!currentUser) {
      setError("账号资料加载失败，请重试");
      redirectHandledRef.current = false;
      return;
    }

    // 点角色触发的登录：直接打开该角色的聊天页，不回发现页，
    // 否则 onboarding / 签到弹窗会在中途抢占并把用户留在发现页。
    const resumeCharacterId = peekResumeCharacterId();
    if (resumeCharacterId) {
      // 点角色才走到登录页，说明访客已经浏览过发现页并选中了角色：
      // 这个浏览器视为导览已完成，登录后的账号不再重放 onboarding。
      markBrowserTourCompleted();
      takeResumeCharacterId();
      router.replace(`/chat/new?character=${encodeURIComponent(resumeCharacterId)}`);
      return;
    }

    router.replace(nextPath ?? "/");
  };

  /* send verification code */
  const handleSendCode = async () => {
    if (!email.trim() || isSendingCode) return;
    setError("");
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
    setIsLoading(true);
    // 从这一刻起跳转只由 handlePostLoginRedirect 负责。
    redirectHandledRef.current = true;
    try {
      await login(email, code);
      await handlePostLoginRedirect();
    } catch (err) {
      redirectHandledRef.current = false;
      setError(getAuthActionErrorMessage(err, "验证码错误或已过期"));
    } finally {
      setIsLoading(false);
    }
  };

  /* ── render ── */
  return (
    <DemoPanel>
      <div className="flex min-h-screen flex-col bg-white lg:min-h-0">
        {/* Header */}
        <header className="flex items-center gap-2.5 px-6 py-7 max-sm:py-5">
          <LogoIcon className="size-7 rounded-lg" />
          <span className="text-lg font-bold tracking-tight">ParlaSoul</span>
        </header>

        {/* Main */}
        <main className="flex flex-1 items-center justify-center px-6 pb-16 max-sm:px-5 max-sm:pb-12">
          <div className="w-full max-w-[400px]">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight max-sm:text-[26px]">
              Welcome to ParlaSoul
            </h1>
            <p className="mb-9 mt-2.5 text-[15px] leading-relaxed text-gray-400">
              Sign in to your account to continue
            </p>

            {/* Error */}
            {error && (
              <Alert className="mb-5 items-center gap-x-1.5 border-0 bg-transparent p-0 text-[13px] leading-5 text-red-600 [&>svg]:translate-y-0">
                <AlertCircle className="size-3.5" />
                <AlertDescription className="text-[13px] leading-5 text-red-600">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Email code form */}
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
              <p className="mt-1 text-center text-xs text-gray-400">
                Can&apos;t find the code? Check your spam or junk folder.
              </p>
            </form>
          </div>
        </main>

        {/* Footer */}
        <footer className="px-10 pb-7 text-center max-sm:px-6">
          <p className="text-xs text-gray-300">
            By continuing, you agree to our{" "}
            <a
              href="/terms"
              className="text-gray-400 underline underline-offset-2 hover:text-gray-500"
            >
              Terms of Use
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              className="text-gray-400 underline underline-offset-2 hover:text-gray-500"
            >
              Privacy Policy
            </a>
          </p>
        </footer>
      </div>
    </DemoPanel>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  );
}
