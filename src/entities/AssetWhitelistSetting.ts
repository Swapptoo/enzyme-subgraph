import { BigInt } from '@graphprotocol/graph-ts';
import { AssetWhitelistSetting, Fund, Policy } from '../generated/schema';
import { logCritical } from '../utils/logCritical';
import { policySettingId } from './PolicySetting';

export function useAssetWhitelistSetting(fund: Fund, policy: Policy): AssetWhitelistSetting {
  let id = policySettingId(fund.id, policy);
  let setting = AssetWhitelistSetting.load(id) as AssetWhitelistSetting;

  if (setting == null) {
    logCritical('Failed to load AssetWhitelistSetting {}.', [id]);
  }

  return setting;
}

export function ensureAssetWhitelistSetting(fundId: string, policy: Policy): AssetWhitelistSetting {
  let id = policySettingId(fundId, policy);
  let setting = AssetWhitelistSetting.load(id) as AssetWhitelistSetting;

  if (setting) {
    return setting;
  }

  setting = new AssetWhitelistSetting(id);
  setting.policy = policy.id;
  setting.fund = fundId;
  setting.listed = new Array<string>();
  setting.assets = new Array<string>();
  setting.events = new Array<string>();
  setting.timestamp = BigInt.fromI32(0);
  setting.enabled = true;
  setting.save();

  return setting;
}
