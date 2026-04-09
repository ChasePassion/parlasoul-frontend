"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth, isProfileComplete } from "@/lib/auth-context";
import {
    getCurrentUser,
    getVerificationCodeDeliveryStatus,
    loginWithPassword,
  registerWithPassword,
  sendVerificationCode,
  signInWithGoogle,
} from "@/lib/api";
import { isSetupBypassPath } from "@/lib/billing-plans";

type PasswordMode = "sign-in" | "sign-up";

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
            return "邮件服务配置有误，请检查 Purelymail SMTP 配置";
        }
        if (error.message.includes("invalid") || error.message.includes("expired")) {
            return "验证码错误或已过期";
        }
        if (error.message.includes("password")) {
            return "邮箱或密码不正确";
        }
        if (error.message.includes("social")) {
            return "第三方登录发起失败，请稍后重试";
        }
    }
    return fallback;
}

function normalizeNextPath(value: string | null) {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return null;
    }

    return trimmed;
}

function resolvePostAuthDestination(
    nextPath: string | null,
    currentUser: Awaited<ReturnType<typeof getCurrentUser>>,
) {
    if (nextPath && (isProfileComplete(currentUser) || isSetupBypassPath(nextPath))) {
        return nextPath;
    }

    return isProfileComplete(currentUser) ? "/" : "/setup";
}

function LoginPageFallback() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    );
}

function LoginPageContent() {
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [step, setStep] = useState<"email" | "code">("email");
    const [activeMethod, setActiveMethod] = useState<"otp" | "password">("otp");
    const [passwordMode, setPasswordMode] = useState<PasswordMode>("sign-in");
    const [error, setError] = useState("");
    const [info, setInfo] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [deliveryTrackingEmail, setDeliveryTrackingEmail] = useState<string | null>(null);

    const { login, refreshUser, user, isLoading: isAuthLoading } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const nextPath = normalizeNextPath(searchParams.get("next"));

    useEffect(() => {
        if (isAuthLoading || !user) {
            return;
        }

        const destination = resolvePostAuthDestination(nextPath, user);
        router.replace(destination);
    }, [user, isAuthLoading, nextPath, router]);

    useEffect(() => {
        if (!deliveryTrackingEmail) {
            return;
        }

        let cancelled = false;

        const pollDeliveryStatus = async () => {
            const slowDeliveryAt = Date.now() + 30000;
            const deadline = Date.now() + 300000;
            let showedSlowDeliveryMessage = false;

            while (!cancelled) {
                try {
                    const result = await getVerificationCodeDeliveryStatus(deliveryTrackingEmail);

                    if (cancelled) {
                        return;
                    }

                    if (result.status === "sent") {
                        setInfo("验证码已发送，请查收邮箱");
                        setDeliveryTrackingEmail(null);
                        return;
                    }

                    if (result.status === "failed") {
                        setInfo("");
                        setError(
                            getAuthActionErrorMessage(
                                new Error(result.errorMessage || "验证码发送失败"),
                                "验证码发送失败，请稍后重试",
                            ),
                        );
                        setStep("email");
                        setDeliveryTrackingEmail(null);
                        return;
                    }
                } catch {
                    // Ignore polling errors inside the short waiting window.
                }

                if (!showedSlowDeliveryMessage && Date.now() >= slowDeliveryAt) {
                    setInfo("验证码正在投递，请稍候查看邮箱，若长时间未收到可返回重试");
                    showedSlowDeliveryMessage = true;
                }

                if (Date.now() >= deadline) {
                    setInfo("验证码正在投递，请稍候查看邮箱，若长时间未收到可返回重试");
                    setDeliveryTrackingEmail(null);
                    return;
                }

                await new Promise((resolve) => setTimeout(resolve, 2000));
            }
        };

        void pollDeliveryStatus();

        return () => {
            cancelled = true;
        };
    }, [deliveryTrackingEmail]);

    const handlePostLoginRedirect = async () => {
        let currentUser = user;

        try {
            await refreshUser();
        } catch (err) {
            console.error("Failed to refresh user after authentication:", err);
        }

        try {
            currentUser = (await getCurrentUser()) || currentUser;
        } catch (err) {
            console.error("Failed to load current user after authentication:", err);
        }

        router.push(resolvePostAuthDestination(nextPath, currentUser));
    };

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setIsLoading(true);

        try {
            await sendVerificationCode(email);
            setStep("code");
            setInfo("验证码正在发送，请稍候查看邮箱");
            setDeliveryTrackingEmail(email.trim().toLowerCase());
        } catch (err) {
            setError(getAuthActionErrorMessage(err, "验证码发送失败，请稍后重试"));
        } finally {
            setIsLoading(false);
        }
    };

    const handleOtpLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setIsLoading(true);

        try {
            await login(email, code);
            await handlePostLoginRedirect();
        } catch (err) {
            setError(getAuthActionErrorMessage(err, "验证码错误或已过期"));
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setInfo("");
        setIsLoading(true);

        try {
            if (passwordMode === "sign-in") {
                await loginWithPassword(email, password);
            } else {
                await registerWithPassword(email, password);
            }
            await handlePostLoginRedirect();
        } catch (err) {
            setError(
                getAuthActionErrorMessage(
                    err,
                    passwordMode === "sign-in"
                        ? "邮箱或密码不正确"
                        : "注册失败，请稍后重试",
                ),
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError("");
        setInfo("");
        setIsLoading(true);

        try {
            await signInWithGoogle(nextPath || "/");
        } catch (err) {
            setError(getAuthActionErrorMessage(err, "Google 登录发起失败"));
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">ParlaSoul</h1>
                        <p className="text-gray-500">
                            {activeMethod === "otp"
                                ? step === "email"
                                    ? "使用邮箱验证码登录"
                                    : "请输入发送到您邮箱的验证码"
                                : passwordMode === "sign-in"
                                    ? "使用邮箱和密码登录"
                                    : "创建一个新的邮箱密码账号"}
                        </p>
                    </div>

                    <div className="mb-6 flex rounded-lg bg-gray-100 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setActiveMethod("otp");
                                setStep("email");
                                setError("");
                                setInfo("");
                                setDeliveryTrackingEmail(null);
                            }}
                            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                                activeMethod === "otp"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500"
                            }`}
                        >
                            邮箱验证码
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveMethod("password");
                                setError("");
                                setInfo("");
                                setDeliveryTrackingEmail(null);
                            }}
                            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                                activeMethod === "password"
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500"
                            }`}
                        >
                            邮箱密码
                        </button>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    {!error && info && (
                        <div className="mb-6 rounded-lg border border-orange-100 bg-orange-50 p-4 text-sm text-orange-600">
                            {info}
                        </div>
                    )}

                    {activeMethod === "otp" && step === "email" ? (
                        <form onSubmit={handleSendCode} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    邮箱地址
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                    placeholder="name@example.com"
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "正在发送..." : "发送验证码"}
                            </button>
                        </form>
                    ) : activeMethod === "otp" ? (
                        <form onSubmit={handleOtpLogin} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="code"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    验证码
                                </label>
                                <input
                                    id="code"
                                    type="text"
                                    required
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-center tracking-widest text-lg"
                                    placeholder="123456"
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? "正在验证..." : "登录"}
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setStep("email");
                                    setInfo("");
                                    setDeliveryTrackingEmail(null);
                                }}
                                className="w-full text-sm text-gray-500 hover:text-gray-700"
                            >
                                ← 返回输入邮箱
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordSubmit} className="space-y-6">
                            <div>
                                <label
                                    htmlFor="password-email"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    邮箱地址
                                </label>
                                <input
                                    id="password-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                    placeholder="name@example.com"
                                    disabled={isLoading}
                                />
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700 mb-2"
                                >
                                    密码
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-400"
                                    placeholder="至少 8 位"
                                    disabled={isLoading}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading
                                    ? passwordMode === "sign-in"
                                        ? "正在登录..."
                                        : "正在注册..."
                                    : passwordMode === "sign-in"
                                        ? "邮箱密码登录"
                                        : "注册并登录"}
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    setPasswordMode((prev) =>
                                        prev === "sign-in" ? "sign-up" : "sign-in",
                                    )
                                }
                                className="w-full text-sm text-gray-500 hover:text-gray-700"
                            >
                                {passwordMode === "sign-in"
                                    ? "没有账号？改为注册"
                                    : "已有账号？改为登录"}
                            </button>
                        </form>
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="w-full border border-gray-300 bg-white text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            使用 Google 登录
                        </button>
                    </div>
                </div>
            </div>
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
