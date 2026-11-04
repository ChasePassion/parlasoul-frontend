import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { middleware } from "./middleware";

function withCheckoutFlag(
  value: string | undefined,
  run: () => void,
) {
  const originalPublicValue = process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;
  const originalServerValue = process.env.BILLING_CHECKOUT_ENABLED;

  if (value === undefined) {
    delete process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;
    delete process.env.BILLING_CHECKOUT_ENABLED;
  } else {
    process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED = value;
    process.env.BILLING_CHECKOUT_ENABLED = value;
  }

  try {
    run();
  } finally {
    if (originalPublicValue === undefined) {
      delete process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_BILLING_CHECKOUT_ENABLED = originalPublicValue;
    }

    if (originalServerValue === undefined) {
      delete process.env.BILLING_CHECKOUT_ENABLED;
    } else {
      process.env.BILLING_CHECKOUT_ENABLED = originalServerValue;
    }
  }
}

test("redirects pricing route when checkout is disabled by default", () => {
  withCheckoutFlag(undefined, () => {
    const response = middleware(
      new NextRequest("http://localhost/pricing?period=monthly"),
    );

    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://localhost/");
  });
});

test("keeps pricing route available when checkout is enabled", () => {
  withCheckoutFlag("true", () => {
    const response = middleware(new NextRequest("http://localhost/pricing"));

    assert.equal(response.headers.get("location"), null);
  });
});
