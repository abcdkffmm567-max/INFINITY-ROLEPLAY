-- INFINITY ROLE PLAY - Redeem Code System
-- Admin creates codes with an eCoin amount.
-- Every 1 eCoin also credits $10 server cash.
-- Requires existing: users, website_account_links.

CREATE TABLE IF NOT EXISTS `website_redeem_codes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(32) NOT NULL,
  `ecoin_reward` INT NOT NULL,
  `cash_reward` INT NOT NULL,
  `max_uses` INT NOT NULL DEFAULT 1,
  `used_count` INT NOT NULL DEFAULT 0,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `expires_at` DATETIME NULL DEFAULT NULL,
  `created_by` VARCHAR(128) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_redeem_code` (`code`),
  KEY `idx_redeem_active` (`active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `website_redeem_claims` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(32) NOT NULL,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `server_uid` INT NOT NULL,
  `ecoin_reward` INT NOT NULL,
  `cash_reward` INT NOT NULL,
  `claimed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_code_per_website_user` (`code_id`,`firebase_uid`),
  KEY `idx_redeem_claim_user` (`firebase_uid`),
  KEY `idx_redeem_claim_server_uid` (`server_uid`),
  CONSTRAINT `fk_redeem_claim_code` FOREIGN KEY (`code_id`) REFERENCES `website_redeem_codes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
