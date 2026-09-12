CREATE TABLE IF NOT EXISTS `website_vehicle_shop` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  `modelid` SMALLINT NOT NULL,
  `ecoin_price` INT NOT NULL,
  `image_url` VARCHAR(500) DEFAULT NULL,
  `description` VARCHAR(300) DEFAULT NULL,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(128) DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `website_vehicle_purchases` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `shop_vehicle_id` BIGINT UNSIGNED NOT NULL,
  `vehicle_id` INT NOT NULL,
  `firebase_uid` VARCHAR(128) NOT NULL,
  `server_uid` INT NOT NULL,
  `server_username` VARCHAR(24) NOT NULL,
  `vehicle_name` VARCHAR(60) NOT NULL,
  `modelid` SMALLINT NOT NULL,
  `ecoin_price` INT NOT NULL,
  `purchased_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vehicle_purchase_user` (`firebase_uid`),
  KEY `idx_vehicle_purchase_server` (`server_uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
