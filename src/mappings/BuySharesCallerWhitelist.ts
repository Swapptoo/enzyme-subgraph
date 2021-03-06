import { ensureAccount, useAccount } from '../entities/Account';
import {
  ensureBuySharesCallerWhitelistSetting,
  useBuySharesCallerWhitelistSetting,
} from '../entities/BuySharesCallerWhitelistSetting';
import { ensureContract } from '../entities/Contract';
import { useFund } from '../entities/Fund';
import { usePolicy } from '../entities/Policy';
import { ensureTransaction } from '../entities/Transaction';
import { AddressesAdded, AddressesRemoved } from '../generated/BuySharesCallerWhitelistContract';
import { ComptrollerLibContract } from '../generated/ComptrollerLibContract';
import {
  BuySharesCallerWhitelistAddressesAddedEvent,
  BuySharesCallerWhitelistAddressesRemovedEvent,
} from '../generated/schema';
import { arrayDiff } from '../utils/arrayDiff';
import { arrayUnique } from '../utils/arrayUnique';
import { genericId } from '../utils/genericId';

export function handleAddressesAdded(event: AddressesAdded): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let fundId = comptroller.getVaultProxy().toHex();
  let policy = usePolicy(event.address.toHex());
  let items = event.params.items.map<string>((item) => item.toHex());

  let addressesAdded = new BuySharesCallerWhitelistAddressesAddedEvent(genericId(event));
  addressesAdded.fund = fundId; // fund does not exist yet
  addressesAdded.account = ensureAccount(event.transaction.from, event).id;
  addressesAdded.contract = ensureContract(event.address, 'BuySharesCallerWhitelist').id;
  addressesAdded.timestamp = event.block.timestamp;
  addressesAdded.transaction = ensureTransaction(event).id;
  addressesAdded.comptrollerProxy = event.params.comptrollerProxy.toHex();
  addressesAdded.items = items;
  addressesAdded.save();

  let setting = ensureBuySharesCallerWhitelistSetting(fundId, policy);
  setting.listed = arrayUnique<string>(setting.listed.concat(items));
  setting.events = arrayUnique<string>(setting.events.concat([addressesAdded.id]));
  setting.timestamp = event.block.timestamp;
  setting.save();
}

export function handleAddressesRemoved(event: AddressesRemoved): void {
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let vault = comptroller.getVaultProxy();
  let fund = useFund(vault.toHex());
  let policy = usePolicy(event.address.toHex());
  let items = event.params.items.map<string>((item) => item.toHex());

  let addressesRemoved = new BuySharesCallerWhitelistAddressesRemovedEvent(genericId(event));
  addressesRemoved.fund = fund.id;
  addressesRemoved.account = useAccount(event.transaction.from.toHex()).id;
  addressesRemoved.contract = event.address.toHex();
  addressesRemoved.timestamp = event.block.timestamp;
  addressesRemoved.transaction = ensureTransaction(event).id;
  addressesRemoved.comptrollerProxy = event.params.comptrollerProxy.toHex();
  addressesRemoved.items = items;
  addressesRemoved.save();

  let setting = useBuySharesCallerWhitelistSetting(fund, policy);
  setting.listed = arrayDiff<string>(setting.listed, items);
  setting.events = arrayUnique<string>(setting.events.concat([addressesRemoved.id]));
  setting.timestamp = event.block.timestamp;
  setting.save();
}
