-- INFINITY ROLE PLAY - Delayed Vehicle Delivery
-- Import this ONCE after infinity_vehicle_shop.sql.

CREATE TABLE IF NOT EXISTS `website_vehicle_settings` (
  `id` TINYINT UNSIGNED NOT NULL,
  `delivery_minutes` INT NOT NULL DEFAULT 180,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `website_vehicle_settings` (`id`,`delivery_minutes`)
VALUES (1,180)
ON DUPLICATE KEY UPDATE `id`=`id`;

ALTER TABLE `website_vehicle_purchases`
  MODIFY `vehicle_id` INT NULL;

ALTER TABLE `website_vehicle_purchases`
  ADD COLUMN IF NOT EXISTS `delivery_status` VARCHAR(16) NOT NULL DEFAULT 'pending' AFTER `ecoin_price`,
  ADD COLUMN IF NOT EXISTS `deliver_at` DATETIME NULL AFTER `delivery_status`,
  ADD COLUMN IF NOT EXISTS `delivered_at` DATETIME NULL AFTER `deliver_at`;

UPDATE `website_vehicle_purchases`
SET `delivery_status`='delivered',
    `delivered_at`=COALESCE(`delivered_at`,`purchased_at`),
    `deliver_at`=COALESCE(`deliver_at`,`purchased_at`)
WHERE `vehicle_id` IS NOT NULL;

