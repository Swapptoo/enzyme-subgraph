import { hexToAscii } from '../utils/hexToAscii';
import { logCritical } from '../utils/logCritical';
import { Fund } from '../generated/schema';

import { NewFundDeployed } from '../generated/FundDeployerContract';
import { ensureManager } from './Account';
import { ensureAsset } from './Asset';
import { createShares } from './Shares';
import { BigDecimal } from '@graphprotocol/graph-ts';
import { createState } from './State';

export function useFund(id: string): Fund {
  let fund = Fund.load(id);
  if (fund == null) {
    logCritical('Failed to load fund {}.', [id]);
  }

  return fund as Fund;
}

export function createFund(event: NewFundDeployed): Fund {
  let fund = new Fund(event.params.vaultProxy.toHex());

  let shares = createShares(BigDecimal.fromString('0'), fund, event, null);
  // let portfolio = createPortfolio([], null, context);
  // let payout = createPayout([], null, context);
  let state = createState(shares, fund, event);

  // let fees = createFees(context);

  fund.name = hexToAscii(event.params.fundName);
  fund.inception = event.block.timestamp;
  fund.manager = ensureManager(event.params.fundOwner).id;
  fund.shares = shares.id;
  // fund.portfolio = portfolio.id;
  fund.state = state.id;
  // fund.active = true;
  fund.denominationAsset = ensureAsset(event.params.denominationAsset).id;
  // fund.payouts = payout.id;
  // fund.fees = fees.map<string>((fee) => fee.id);
  fund.save();

  return fund;
}

// function investableAssets(context: Context): Asset[] {
//   let participation = context.contracts.participation;
//   let assets = context.entities.version.assets;
//   let investable: Asset[] = [];
//   for (let i: i32 = 0; i < assets.length; i++) {
//     if (!participation.investAllowed(Address.fromString(assets[i]))) {
//       continue;
//     }

//     investable.push(useAsset(assets[i]));
//   }

//   return investable;
// }
