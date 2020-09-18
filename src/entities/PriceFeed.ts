import { Address } from '@graphprotocol/graph-ts';
import { PriceFeed } from '../generated/schema';

export function ensurePriceFeed(priceFeedAddress: Address): PriceFeed {
  let priceFeed = PriceFeed.load(priceFeedAddress.toHex()) as PriceFeed;
  if (priceFeed) {
    return priceFeed;
  }

  priceFeed = new PriceFeed(priceFeedAddress.toHex());
  priceFeed.assets = [];
  return priceFeed;
}