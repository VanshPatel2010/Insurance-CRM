import { Metadata } from "next";
import ClaimsClient from "./ClaimsClient";

export const metadata: Metadata = { title: 'Claims — InsureCRM' };

export default function ClaimsPage() {
  return <ClaimsClient />;
}
