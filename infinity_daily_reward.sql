-- ============================================================
-- INFINITY ROLE PLAY - WEBSITE DAILY REWARD SYSTEM
-- Daily reward: +100 eCoin and +$1,000 server cash
-- Existing SA-MP player table: users
-- Existing player key: uid
-- Existing balances: ecoin, cash
-- ============================================================

CREATE TABLE IF NOT EXISTS `website_account_links` (
  `firebase_uid` VARCHAR(128) NOT NULL,
  `server_uid` INT NOT NULL,
  `server_username` VARCHAR(24) NOT NULL,
  `linked_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`firebase_uid`),
  UNIQUE KEY `uniq_server_uid` (`server_uid`),
  KEY `idx_server_username` (`server_username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `website_daily_rewards` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `server_uid` INT NOT NULL,
  `claim_date` DATE NOT NULL,
  `ecoin_reward` INT NOT NULL DEFAULT 100,
  `cash_reward` INT NOT NULL DEFAULT 1000,
  `claimed_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_server_daily_claim` (`server_uid`, `claim_date`),
  UNIQUE KEY `uniq_firebase_daily_claim` (`firebase_uid`, `claim_date`),
  KEY `idx_reward_server_uid` (`server_uid`),
  KEY `idx_reward_firebase_uid` (`firebase_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Optional SQL-only claim procedure for testing/admin use.
DROP PROCEDURE IF EXISTS `claim_daily_reward`;
DELIMITER $$
CREATE PROCEDURE `claim_daily_reward`(
  IN p_firebase_uid VARCHAR(128),
  IN p_server_uid INT,
  IN p_claim_date DATE
)
BEGIN
  DECLARE linked_count INT DEFAULT 0;
  DECLARE player_count INT DEFAULT 0;

  START TRANSACTION;

  SELECT COUNT(*) INTO linked_count
  FROM `website_account_links`
  WHERE `firebase_uid` = p_firebase_uid
    AND `server_uid` = p_server_uid;

  IF linked_count = 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SERVER_ACCOUNT_NOT_LINKED';
  END IF;

  SELECT COUNT(*) INTO player_count
  FROM `users`
  WHERE `uid` = p_server_uid
  FOR UPDATE;

  IF player_count = 0 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PLAYER_NOT_FOUND';
  END IF;

  INSERT INTO `website_daily_rewards`
    (`firebase_uid`, `server_uid`, `claim_date`, `ecoin_reward`, `cash_reward`)
  VALUES
    (p_firebase_uid, p_server_uid, p_claim_date, 100, 1000);

  UPDATE `users`
  SET `ecoin` = COALESCE(`ecoin`, 0) + 100,
      `cash`  = COALESCE(`cash`, 0) + 1000
  WHERE `uid` = p_server_uid;

  COMMIT;
END$$
DELIMITER ;

-- Test after you have linked an account:
-- CALL claim_daily_reward('FIREBASE_UID_HERE', 1075, CURDATE());
