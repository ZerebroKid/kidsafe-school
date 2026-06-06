/**
 * One-off CLI script to create the Razorpay subscription plan for Zerebro Campus.
 *
 * Creates a monthly plan at ₹99/student (9900 paise) in INR. Run once per
 * environment (test / live) and store the returned plan_id in your environment
 * config (RAZORPAY_PLAN_ID).
 *
 * Usage:
 *   # Set env vars first:
 *   export RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXX
 *   export RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
 *
 *   # Then run:
 *   pnpm create:plan
 *
 * The script prints the plan_id on success. Store it:
 *   firebase functions:config:set razorpay.plan_id="plan_XXXXXXXXXXXXXX"
 *   # Or add RAZORPAY_PLAN_ID=plan_XXXXXXXXXXXXXX to your .env
 */

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error(
      'ERROR: Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.\n' +
        '  export RAZORPAY_KEY_ID=rzp_test_...\n' +
        '  export RAZORPAY_KEY_SECRET=...',
    );
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require('razorpay');
  const razorpay = new Razorpay({key_id: keyId, key_secret: keySecret});

  console.log('Creating Razorpay plan...');
  console.log('  Period:   monthly');
  console.log('  Amount:   ₹99 (9900 paise)');
  console.log('  Currency: INR');
  console.log('');

  try {
    const plan = await razorpay.plans.create({
      period: 'monthly',
      interval: 1,
      item: {
        name: 'Zerebro Campus — Per Student',
        amount: 9900,
        currency: 'INR',
        description:
          'Monthly subscription for Zerebro Campus school management. Billed per student.',
      },
    });

    console.log('Plan created successfully!');
    console.log('');
    console.log(`  plan_id: ${plan.id}`);
    console.log(`  name:    ${plan.item.name}`);
    console.log(`  amount:  ${plan.item.amount} paise (₹${plan.item.amount / 100})`);
    console.log(`  period:  ${plan.period} (interval: ${plan.interval})`);
    console.log('');
    console.log('Next steps:');
    console.log(`  1. Store this plan_id in your environment config:`);
    console.log(`     echo "RAZORPAY_PLAN_ID=${plan.id}" >> .env`);
    console.log(`  2. Or set via Firebase params:`);
    console.log(
      `     firebase functions:secrets:set RAZORPAY_PLAN_ID`,
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : JSON.stringify(err, null, 2);
    console.error('Failed to create plan:', message);
    process.exit(1);
  }
}

main();
