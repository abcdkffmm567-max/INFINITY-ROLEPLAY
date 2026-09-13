-- Infinity Role Play - persistent website eCoin wallet
CREATE TABLE IF NOT EXISTS `website_ecoin_wallets` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `ecoin` BIGINT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
