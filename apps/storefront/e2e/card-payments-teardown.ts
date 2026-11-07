import { setCardPayments } from "./card-payments";

export default async function teardown() {
  await setCardPayments(false);
}
