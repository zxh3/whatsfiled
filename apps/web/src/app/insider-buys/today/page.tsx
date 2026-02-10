import { redirect } from "next/navigation";
import { getEasternDateString } from "@/lib/insider-buys";

export default function InsiderBuysTodayPage() {
  redirect(`/insider-buys/${getEasternDateString()}`);
}
