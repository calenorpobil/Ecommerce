import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 10000;

export async function POST(req: NextRequest) {
  const { amount, walletAddress } = await req.json();

  if (
    typeof amount !== "number" ||
    amount < MIN_AMOUNT ||
    amount > MAX_AMOUNT
  ) {
    return NextResponse.json(
      { error: `Monto inválido. Debe estar entre ${MIN_AMOUNT} y ${MAX_AMOUNT} EUR.` },
      { status: 400 }
    );
  }

  if (!walletAddress || !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: "Dirección de wallet inválida." },
      { status: 400 }
    );
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Stripe usa centavos
    currency: "eur",
    metadata: { walletAddress, tokenAmount: String(amount) },
  });

  return NextResponse.json({ clientSecret: paymentIntent.client_secret });
}
