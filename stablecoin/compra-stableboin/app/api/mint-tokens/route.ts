import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { JsonRpcProvider, Wallet, Contract } from "ethers";
import { hasBeenMinted, markAsMinted } from "@/lib/mintedPayments";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const EUROTOKEN_ABI = ["function mint(address to, uint256 amount) external"];

export async function POST(req: NextRequest) {
  try {
    const { paymentIntentId } = await req.json();

    if (!paymentIntentId) {
      return NextResponse.json({ error: "paymentIntentId requerido." }, { status: 400 });
    }

    if (hasBeenMinted(paymentIntentId)) {
      return NextResponse.json({ success: true, duplicate: true });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: `Pago no confirmado. Estado: ${paymentIntent.status}` },
        { status: 402 }
      );
    }

    const walletAddress = paymentIntent.metadata.walletAddress;
    const tokenAmount = Number(paymentIntent.metadata.tokenAmount);

    if (!walletAddress || !tokenAmount) {
      return NextResponse.json({ error: "Metadata del pago incompleta." }, { status: 400 });
    }

    const provider = new JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL);
    const signer = new Wallet(process.env.WALLET_PRIVATE_KEY!, provider);
    const contract = new Contract(
      process.env.NEXT_PUBLIC_EUROTOKEN_CONTRACT_ADDRESS!,
      EUROTOKEN_ABI,
      signer
    );

    markAsMinted(paymentIntentId); // reservar antes del mint para evitar race condition con el webhook
    const mintAmount = BigInt(tokenAmount) * BigInt(10) ** BigInt(6);
    const tx = await contract.mint(walletAddress, mintAmount);
    await tx.wait();

    return NextResponse.json({ success: true, txHash: tx.hash });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error interno del servidor";
    console.error("[mint-tokens]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
