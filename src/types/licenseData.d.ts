export type licenseData = {
  id: string;
  guildId: string;
  key: string;
  role: string;
  author: string;
  redeemer?: string;
  activated: boolean;
  createdAt: Date;
  updatedAt: Date;
  validUntil: bigint;
};
