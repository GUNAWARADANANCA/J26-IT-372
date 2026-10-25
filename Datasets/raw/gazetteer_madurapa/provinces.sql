SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;


DROP TABLE IF EXISTS `provinces`;
CREATE TABLE `provinces` (
  `id` int NOT NULL,
  `name_en` varchar(45) NOT NULL,
  `name_si` varchar(45) DEFAULT NULL,
  `name_ta` varchar(45) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

INSERT INTO `provinces` (`id`, `name_en`, `name_si`, `name_ta`) VALUES
(1, 'Western', 'බස්නාහිර', 'மேல்'),
(2, 'Central', 'මධ්‍යම', 'மத்திய'),
(3, 'Southern', 'දකුණු', 'தென்'),
(4, 'North Western', 'වයඹ', 'வட மேல்'),
(5, 'Sabaragamuwa', 'සබරගමුව', 'சபரகமுவ'),
(6, 'Eastern', 'නැගෙනහිර', 'கிழக்கு'),
(7, 'Uva', 'ඌව', 'ஊவா'),
(8, 'North Central', 'උතුරු මැද', 'வட மத்திய'),
(9, 'Northern', 'උතුරු', 'வட');


ALTER TABLE `provinces`
  ADD PRIMARY KEY (`id`);


ALTER TABLE `provinces`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
