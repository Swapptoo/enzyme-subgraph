import { useManager } from '../entities/Account';
import { ensureContract } from '../entities/Contract';
import { ensurePolicy, usePolicy } from '../entities/Policy';
import { ensureTransaction } from '../entities/Transaction';
import { ComptrollerLibContract } from '../generated/ComptrollerLibContract';
import { PolicyDeregistered, PolicyEnabledForFund, PolicyRegistered } from '../generated/PolicyManagerContract';
import { PolicyDeregisteredEvent, PolicyEnabledForFundEvent, PolicyRegisteredEvent } from '../generated/schema';
import { arrayUnique } from '../utils/arrayUnique';
import { genericId } from '../utils/genericId';

export function handlePolicyRegistered(event: PolicyRegistered): void {
  let registration = new PolicyRegisteredEvent(genericId(event));
  registration.timestamp = event.block.timestamp;
  registration.transaction = ensureTransaction(event).id;
  registration.contract = ensureContract(event.address, 'PolicyManager').id;
  registration.policy = ensurePolicy(event.params.policy).id;
  registration.identifier = event.params.identifier.toHex();
  registration.save();
}

export function handlePolicyDeregistered(event: PolicyDeregistered): void {
  let deregistration = new PolicyDeregisteredEvent(genericId(event));
  deregistration.timestamp = event.block.timestamp;
  deregistration.transaction = ensureTransaction(event).id;
  deregistration.contract = event.address.toHex();
  deregistration.policy = usePolicy(event.params.policy.toHex()).id;
  deregistration.identifier = event.params.identifier.toHex();
  deregistration.save();
}

export function handlePolicyEnabledForFund(event: PolicyEnabledForFund): void {
  // TODO: Instead of calling the contract, load the vault proxy from the fund / fund version entity.
  let comptroller = ComptrollerLibContract.bind(event.params.comptrollerProxy);
  let fundId = comptroller.getVaultProxy().toHex();
  let policy = usePolicy(event.params.policy.toHex());

  let enabled = new PolicyEnabledForFundEvent(genericId(event));
  enabled.fund = fundId;
  enabled.account = useManager(event.transaction.from.toHex()).id;
  enabled.timestamp = event.block.timestamp;
  enabled.transaction = ensureTransaction(event).id;
  enabled.contract = event.address.toHex();
  enabled.policy = policy.id;
  enabled.save();

  policy.funds = arrayUnique<string>(policy.funds.concat([fundId]));
  policy.save();
}
