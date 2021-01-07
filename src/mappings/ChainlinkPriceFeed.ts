import {
  audChainlinkAggregator,
  btcChainlinkAggregator,
  chfChainlinkAggregator,
  eurChainlinkAggregator,
  gbpChainlinkAggregator,
  jpyChainlinkAggregator,
  wethTokenAddress,
} from '../addresses';
import { zeroAddress } from '../constants';
import { ensureAsset } from '../entities/Asset';
import { trackAssetPrice } from '../entities/AssetPrice';
import {
  disableChainlinkAssetAggregator,
  disableChainlinkEthUsdAggregator,
  enableChainlinkAssetAggregator,
  enableChainlinkCurrencyAggregator,
  enableChainlinkEthUsdAggregator,
} from '../entities/ChainlinkAggregator';
import { ensureContract, useContract } from '../entities/Contract';
import { ensureCurrency } from '../entities/Currency';
import { ensureTransaction } from '../entities/Transaction';
import { ChainlinkAggregatorContract } from '../generated/ChainlinkAggregatorContract';
import { ChainlinkAggregatorProxyContract } from '../generated/ChainlinkAggregatorProxyContract';
import {
  EthUsdAggregatorSet,
  PrimitiveAdded,
  PrimitiveRemoved,
  PrimitiveUpdated,
} from '../generated/ChainlinkPriceFeedContract';
import {
  AggregatorUpdatedEvent,
  EthUsdAggregatorSetEvent,
  PrimitiveAddedEvent,
  PrimitiveRemovedEvent,
} from '../generated/schema';
import { arrayDiff } from '../utils/arrayDiff';
import { arrayUnique } from '../utils/arrayUnique';
import { ensureCron, triggerCron } from '../utils/cronManager';
import { genericId } from '../utils/genericId';
import { toBigDecimal } from '../utils/toBigDecimal';

export function handleEthUsdAggregatorSet(event: EthUsdAggregatorSet): void {
  let ethUsdAggregatorSet = new EthUsdAggregatorSetEvent(genericId(event));
  ethUsdAggregatorSet.contract = ensureContract(event.address, 'ChainlinkPriceFeed').id;
  ethUsdAggregatorSet.timestamp = event.block.timestamp;
  ethUsdAggregatorSet.transaction = ensureTransaction(event).id;
  ethUsdAggregatorSet.prevEthUsdAggregator = event.params.prevEthUsdAggregator.toHex();
  ethUsdAggregatorSet.nextEthUsdAggregator = event.params.nextEthUsdAggregator.toHex();
  ethUsdAggregatorSet.save();

  if (!event.params.prevEthUsdAggregator.equals(zeroAddress)) {
    let proxy = ChainlinkAggregatorProxyContract.bind(event.params.prevEthUsdAggregator);
    let aggregator = proxy.aggregator();
    disableChainlinkEthUsdAggregator(aggregator);
  }

  let proxy = ChainlinkAggregatorProxyContract.bind(event.params.nextEthUsdAggregator);
  let aggregator = proxy.aggregator();
  let eth = ensureCurrency('ETH');
  enableChainlinkEthUsdAggregator(aggregator, eth);

  // Create WETH manually
  let weth = ensureAsset(wethTokenAddress);
  if (weth.type != 'ETH') {
    weth.type = 'ETH';
    weth.save();
  }

  // Aggregators for currencies
  let audProxy = ChainlinkAggregatorProxyContract.bind(audChainlinkAggregator);
  let audAggregator = audProxy.aggregator();
  let aud = ensureCurrency('AUD');
  enableChainlinkCurrencyAggregator(audAggregator, aud);

  let btcProxy = ChainlinkAggregatorProxyContract.bind(btcChainlinkAggregator);
  let btcAggregator = btcProxy.aggregator();
  let btc = ensureCurrency('BTC');
  enableChainlinkCurrencyAggregator(btcAggregator, btc);

  let chfProxy = ChainlinkAggregatorProxyContract.bind(chfChainlinkAggregator);
  let chfAggregator = chfProxy.aggregator();
  let chf = ensureCurrency('CHF');
  enableChainlinkCurrencyAggregator(chfAggregator, chf);

  let eurProxy = ChainlinkAggregatorProxyContract.bind(eurChainlinkAggregator);
  let eurAggregator = eurProxy.aggregator();
  let eur = ensureCurrency('EUR');
  enableChainlinkCurrencyAggregator(eurAggregator, eur);

  let gbpProxy = ChainlinkAggregatorProxyContract.bind(gbpChainlinkAggregator);
  let gbpAggregator = gbpProxy.aggregator();
  let gbp = ensureCurrency('GBP');
  enableChainlinkCurrencyAggregator(gbpAggregator, gbp);

  let jpyProxy = ChainlinkAggregatorProxyContract.bind(jpyChainlinkAggregator);
  let jpyAggregator = jpyProxy.aggregator();
  let jpy = ensureCurrency('JPY');
  enableChainlinkCurrencyAggregator(jpyAggregator, jpy);

  // USD has not chainlink price source, USD / USD is always 1
  let usd = ensureCurrency('USD');

  let cron = ensureCron();
  cron.primitives = arrayUnique<string>(cron.primitives.concat([weth.id]));
  cron.currencies = arrayUnique<string>(
    cron.currencies.concat([aud.id, btc.id, chf.id, eth.id, eur.id, gbp.id, jpy.id, usd.id]),
  );
  cron.save();

  // It's important that we run cron last.
  triggerCron(event.block.timestamp);
}

// TODO: Chainlink uses proxies for their price oracles. Sadly, these proxies do not
// emit events whenever the underlying aggregator changes. Chainlink has proposed that
// they could add a central registry that emits an event whenever an aggregator changes.
//
// If they can't make this happen, an alternative solution could be to monitor these
// changes (through contract calls) either as part of cron or by checking and comparing
// the current aggregator whenever we track an AnswerUpdated event and swap out the
// underlying aggregator whenever we observe a change. This would be possible because
// chainlink (allegedly) keeps updating the "old" aggregator for a limited amount of time
// even after they've migrated to a new one and pointed the proxy to the new aggregator.

export function handlePrimitiveAdded(event: PrimitiveAdded): void {
  let primitive = ensureAsset(event.params.primitive);
  primitive.type = event.params.rateAsset == 1 ? 'USD' : 'ETH';
  primitive.save();

  let primitivePriceFeedAdded = new PrimitiveAddedEvent(genericId(event));
  primitivePriceFeedAdded.primitive = primitive.id;
  primitivePriceFeedAdded.contract = ensureContract(event.address, 'ChainlinkPriceFeed').id;
  primitivePriceFeedAdded.timestamp = event.block.timestamp;
  primitivePriceFeedAdded.transaction = ensureTransaction(event).id;
  primitivePriceFeedAdded.priceFeed = event.params.aggregator.toHex();
  primitivePriceFeedAdded.rateAsset = event.params.rateAsset;
  primitivePriceFeedAdded.save();

  let proxy = ChainlinkAggregatorProxyContract.bind(event.params.aggregator);
  let aggregator = proxy.aggregator();

  // Whenever a new asset is registered, we need to fetch its current price immediately.
  let contract = ChainlinkAggregatorContract.bind(aggregator);
  let current = toBigDecimal(contract.latestAnswer(), primitive.type === 'USD' ? 8 : 18);
  trackAssetPrice(primitive, event.block.timestamp, current);

  // Keep tracking this asset using the registered chainlink aggregator.
  enableChainlinkAssetAggregator(aggregator, primitive);

  let cron = ensureCron();
  cron.primitives = arrayUnique<string>(cron.primitives.concat([primitive.id]));
  if (primitive.type == 'USD') {
    cron.usdQuotedPrimitives = arrayUnique<string>(cron.primitives.concat([primitive.id]));
  }
  cron.save();

  // It's important that we run cron last.
  triggerCron(event.block.timestamp);
}

export function handlePrimitiveRemoved(event: PrimitiveRemoved): void {
  let primitive = ensureAsset(event.params.primitive);

  let primitivePriceFeedRemoved = new PrimitiveRemovedEvent(genericId(event));
  primitivePriceFeedRemoved.primitive = primitive.id;
  primitivePriceFeedRemoved.contract = ensureContract(event.address, 'ChainlinkPriceFeed').id;
  primitivePriceFeedRemoved.timestamp = event.block.timestamp;
  primitivePriceFeedRemoved.transaction = ensureTransaction(event).id;
  primitivePriceFeedRemoved.save();

  let cron = ensureCron();
  cron.primitives = arrayDiff<string>(cron.primitives, [primitive.id]);
  if (primitive.type == 'USD') {
    cron.usdQuotedPrimitives = arrayDiff<string>(cron.primitives, [primitive.id]);
  }
  cron.save();

  // It's important that we run cron last.
  triggerCron(event.block.timestamp);
}

export function handlePrimitiveUpdated(event: PrimitiveUpdated): void {
  let primitive = ensureAsset(event.params.primitive);

  let primitiveUpdated = new AggregatorUpdatedEvent(genericId(event));
  primitiveUpdated.contract = useContract(event.address.toHex()).id;
  primitiveUpdated.timestamp = event.block.timestamp;
  primitiveUpdated.transaction = ensureTransaction(event).id;
  primitiveUpdated.primitive = primitive.id;
  primitiveUpdated.prevAggregator = event.params.prevAggregator.toHex();
  primitiveUpdated.nextAggregator = event.params.nextAggregator.toHex();
  primitiveUpdated.save();

  if (!event.params.prevAggregator.equals(zeroAddress)) {
    let proxy = ChainlinkAggregatorProxyContract.bind(event.params.prevAggregator);
    let aggregator = proxy.aggregator();
    disableChainlinkAssetAggregator(aggregator, primitive);
  }

  let proxy = ChainlinkAggregatorProxyContract.bind(event.params.nextAggregator);
  let aggregator = proxy.aggregator();

  // Whenever a new asset is registered, we need to fetch its current price immediately.
  let contract = ChainlinkAggregatorContract.bind(aggregator);
  let current = toBigDecimal(contract.latestAnswer(), primitive.type === 'USD' ? 8 : 18);
  trackAssetPrice(primitive, event.block.timestamp, current);

  // Keep tracking this asset using the registered chainlink aggregator.
  enableChainlinkAssetAggregator(aggregator, primitive);
}
