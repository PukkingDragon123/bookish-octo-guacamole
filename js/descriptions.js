// คำอธิบาย — descriptions for everything in the chest (หีบหนัง), every move
// a puppet can play, and every chest drawer. Pure data, no imports.
//
//   ITEM_INFO[id]   = { th, en, tips?: ['ไทย · English', ...] }
//   MOVE_INFO[name] = { th, en, cat }  cat: fight | dance | gesture | posture | social | sport | animal
//   CAT_INFO[cat]   = { th, en }
//
// Scene ids are 'scene-' + the scene id in sandbox/scenes.js.

export const ITEM_INFO = {
  // ================================================================ puppets — classical
  phra: {
    th: "พระเอกผู้สูงศักดิ์ในชฎายอดแหลม ฉลุลายทองอย่างประณีต เป็นตัวแทนความดีและความกล้าหาญในเรื่องรามเกียรติ์และนิทานจักร ๆ วงศ์ ๆ ในหนังตะลุงพระเอกมักถือศรหรือพระขรรค์ ออกรบปราบยักษ์และพาเรื่องเดินไปข้างหน้า",
    en: "The noble prince in a tall pointed crown, cut with fine gilt lace. He stands for courage and virtue in the Ramakien and royal folk tales; in shadow play he carries the bow or sword, fights the demons and drives the story on.",
    tips: ["ให้เทวดาบทนักดาบ แล้ววางดาบที่มือ · Give him the Fighter role and drop a sword on his hand", "บทนางรำก็รำแม่ท่าได้งาม · As a Dancer he works through the classical ท่ารำ", "ปลุกเสกวิญญาณก่อนรบจริง · Give him a soul for a fight that matters"],
  },
  yak: {
    th: "ยักษ์ตาโปน เขี้ยวงอก ชฎายอดกนกลุกเป็นเปลว เป็นฝ่ายอธรรมแห่งกรุงลงกาในรามเกียรติ์ ตัวใหญ่ เสียงดัง ขู่คำรามจนทั้งโรงสะเทือน สัตว์ในฉากมักหนีเมื่อยักษ์เข้าใกล้ และหมาจะเห่าไล่",
    en: "A goggle-eyed demon with tusks and a flame-tipped crown, from the Lanka side of the Ramakien. Big, loud and terrifying when he roars; animals keep their distance and dogs bark at him.",
    tips: ["บทปีศาจ: ไล่ฟันทุกคนไม่เลือกหน้า · Monster role: attacks anyone in reach", "กด 7 เพื่อคำราม · Press 7 to roar", "สัตว์ขี้ตกใจจะวิ่งหนียักษ์ · Timid animals flee from demons"],
  },
  hanuman: {
    th: "หนุมาน ทหารเอกวานรเผือกของพระราม บุตรพระพาย มีฤทธิ์เหาะเหินและหาวเป็นดาวเป็นเดือน ในรามเกียรติ์เขาเป็นผู้ถือแหวนไปถวายนางสีดาและเผากรุงลงกาด้วยหางไฟ ซุกซนแต่ภักดีที่สุด",
    en: "Hanuman, the white monkey general of Rama and son of the Wind God, who can leap across seas and yawn out stars and moons. In the Ramakien he carries Rama's ring to Sita and sets Lanka ablaze with his burning tail — mischievous, and utterly loyal.",
    tips: ["กระโดดสูงด้วยปุ่ม 6 · Big leaps on key 6", "เข้าฉากศึกกรุงลงกาเป็นนักรบ · He fights in the Battle of Lanka scene", "ถือตรีศูลหรือกระบองก็ดุดี · Looks fierce with a trident or club"],
  },
  phaya: {
    th: "พญาผู้ครองเมือง สวมชฎาและเครื่องทรงเต็มยศ ท่าทางสุขุมแบบผู้อาวุโส ในหนังตะลุงพระราชามักออกฉากว่าราชการ ประกาศศึก หรือรับแขกเมือง เสียงทุ้มต่ำมีอำนาจ",
    en: "The ruling king in crown and full regalia, with the calm bearing of an elder. In shadow play the king holds court, declares war or receives envoys, speaking in a deep, commanding voice.",
    tips: ["บทชาวบ้านจะทักทายและไหว้ · As a Villager he greets and wais", "ในฉากลงกาถือดาบสองมือ · Holds the long-hilted sword at Lanka"],
  },
  thewada: {
    th: "เทวดาผู้งดงามจากสรวงสวรรค์ ชฎายอดชัยประดับกระจัง ปรากฏเมื่อเรื่องต้องการพรหรือปาฏิหาริย์ ในโรงละครนี้เหล่าเทวดาตัวน้อยยังเป็นผู้ชักใยหนังให้ตัวหนังทุกตัวด้วย",
    en: "A radiant deva from the heavens in a tiered victory crown, appearing when the story needs a blessing or a miracle. In this theatre, little devas are also the stagehands who work every puppet's strings.",
    tips: ["บทนางรำเข้ากับเทวดาที่สุด · The Dancer role suits a deva best", "ไหว้ด้วยปุ่ม 5 · Wai with key 5"],
  },
  reusi: {
    th: "ฤๅษีชราผู้บำเพ็ญพรตในป่าหิมพานต์ ผมหยิกเคราขาว ถือไม้เท้าและหม้อน้ำมนต์ ในหนังตะลุงพ่อแก่ฤๅษีเป็นครูผู้ประสิทธิ์ประสาทวิชา และมักออกมาเบิกโรงก่อนเรื่องจะเริ่ม",
    en: "The old hermit who meditates in the Himmaphan forest, white-bearded with tight curls, carrying a staff and a holy-water pot. In shadow play the Ruesi is the revered teacher who blesses the show, and often opens the performance.",
    tips: ["มาพร้อมไม้เท้า (อาวุธทื่อ) และหม้อน้ำมนต์ · Comes with his staff (blunt weapon) and holy-water pot", "ฉากป่าหิมพานต์เปิดด้วยฤๅษีไหว้ · Opens the Himmaphan scene with a wai"],
  },
  nang: {
    th: "นางเอกผู้อ่อนช้อย สวมมงกุฎและสไบลายทอง ถือพัดในมือ เป็นทั้งเจ้าหญิงในวังและหญิงงามกลางสวนดอกไม้ แม้ดูบอบบางแต่ใจกล้า และรำได้งามที่สุดในโรง",
    en: "The graceful heroine in a crown and gilded shawl, fan in hand — a princess of the palace and a beauty of the flower garden. Delicate to look at but brave at heart, and the loveliest dancer on the cloth.",
    tips: ["บทนางรำ: รำแม่ท่าวนไปเรื่อย ๆ · Dancer role: cycles through the classical dances", "บทแม่ค้าในฉากตลาดน้ำ · Plays a merchant at the floating market"],
  },

  // ================================================================ puppets — comic & villagers
  teng: {
    th: "ไอ้เท่ง ตัวตลกเอกของหนังตะลุงภาคใต้ จมูกงุ้ม ปากหนา นิ้วชี้ยาวคดชี้หน้าคนไปทั่ว พูดภาษาใต้ทะเล้นทะลึ่ง กล้าเสียดสีเจ้านาย เป็นขวัญใจคนดูมาหลายชั่วอายุคน",
    en: "Ai Teng, the star clown of southern Thai shadow play: hooked nose, thick lips, and that long crooked finger always pointing at someone. He jokes in the southern dialect, mocks his betters without fear, and has been the crowd's darling for generations.",
    tips: ["บทตัวตลก: เดินเล่น หัวเราะ แกล้งตีเพื่อน · Comedian role: wanders, laughs and swats at friends", "ปากขยับได้ตามเส้นเชือก · His jaw moves on its own string when he talks"],
  },
  nunui: {
    th: "หนูนุ้ย ตัวตลกพุงพลุ้ยผมทรงหงอนไก่ ถือมีดเล่มโตไว้ข้างหลังเสมอ ซื่อจนเซ่อ ขี้คุยโวแต่ขี้กลัว มักเป็นคู่หูคอยรับมุกของไอ้เท่ง",
    en: "Nu Nui, the pot-bellied clown with a cockscomb of hair and a big knife always in his back hand. Simple to the point of silly, boastful but cowardly — usually Ai Teng's sidekick and straight man.",
    tips: ["ออกโรงพร้อมมีดพร้าในมือหลัง · Spawns holding a machete", "ลองบทขี้ขลาดให้วิ่งหนีนักรบ · Try the Scaredy-cat role"],
  },
  yodthong: {
    th: "ยอดทอง ตัวตลกอ้วนพุงกลม ผมขมวดเป็นก้นหอย หนวดเหมือนวอลรัส ชอบวางท่าเป็นผู้ดี ยกนิ้วชี้สั่งการ แต่ไม่เคยทำอะไรสำเร็จสักอย่าง",
    en: "Yodthong, the pompous fat man with snail-curl hair, a walrus moustache and a raised pointing finger. He puts on grand airs and gives orders, yet never manages to get anything done.",
    tips: ["ในฉากลานกีฬาเขาเล่นปิงปอง · Plays ping-pong in the Village games scene"],
  },
  samor: {
    th: "สะหม้อ ตาเฒ่าขี้บ่น คาดผ้าลายรอบหัว จมูกห้อย ปากจู๋ หลังค่อม ถือมีดโค้งห้อยไว้ในมือ บ่นทุกเรื่องตั้งแต่ฟ้าฝนยันลูกหลาน",
    en: "Samor, the grumbling old man with a striped headband, drooping nose, pursed lips and a hunched back, a curved blade dangling from his hand. He complains about everything from the weather to the youngsters.",
    tips: ["ถือมีดพร้าติดมือมาด้วย · Comes holding a machete", "เสียงแบบคนแก่ · Speaks with an old man's voice"],
  },
  srikaew: {
    th: "ศรีแก้ว ตัวตลกหัวล้านอ้วนท้วน หูกาง ปากยื่น นุ่งโสร่งตาหมากรุกผืนใหญ่ หิวตลอดเวลาและหาเรื่องกินได้ทุกฉาก",
    en: "Srikaew, the plump bald clown with a jug ear, a pouting mouth and a big checked sarong. Always hungry, and finds something to eat in every scene.",
    tips: ["วางอาหารที่มือให้ถือ · Drop food on his hand for him to hold"],
  },
  khwanmuang: {
    th: "ขวัญเมือง ตัวตลกย้อมสีเขียว จมูกยาวงอนเหมือนปากจระเข้ ผมหยิกเป็นกระจุกที่ท้ายทอย ฉลาดแกมโกง ปากไวและมุกคมกว่าใคร",
    en: "Khwan Muang, the green-dyed clown with a long crocodile snout curling up at the tip and a tuft of ringlets at the nape. Sly, quick-tongued, with the sharpest wit in the troupe.",
  },
  phuyaiphoon: {
    th: "ผู้ใหญ่พูน ผู้ใหญ่บ้านหลังโก่ง ก้นโด่ง เข่างอ ตาเสี้ยว จมูกกลม คาดผ้าแดงประจำตำแหน่ง ชอบประกาศเรื่องสำคัญของหมู่บ้านอย่างยืดยาว",
    en: "Phuyai Phoon, the village headman — hunched, bottom out, knees bent, with a crescent eye, bulb nose and the red sash of office. Loves to make long announcements about village affairs.",
    tips: ["บทชาวบ้านในฉากทุ่งนา · Plays a villager in the rice-fields scene"],
  },
  aitho: {
    th: "ไอ้โถ นักวิ่งร่างผอม ผมขาวชี้ฟู ฟันเหยินตาเหล่ ขายาวเก้งก้าง ใจร้อนวิ่งไปทั่ว เป็นตัวตลกที่ทำให้ฉากวุ่นวายสนุกขึ้น",
    en: "Ai Tho, the wiry runner with wild pale hair streaming back, a toothy grin, a cross-eyed stare and long bony legs. Always in a hurry, he turns any scene into happy chaos.",
    tips: ["ขายาวเหมาะกับบทเตะตะกร้อ · Those long legs suit the Takraw role"],
  },
  "chaoban-man": {
    th: "ชาวนาสวมงอบ เสื้อม่อฮ่อมสีคราม คาดผ้าขาวม้าลายตาราง นุ่งกางเกงครึ่งแข้ง เท้าเปล่า คนธรรมดาที่เป็นกระดูกสันหลังของหมู่บ้าน",
    en: "A rice farmer in a woven ngop hat and indigo mo hom shirt, a checked pha khao ma knotted at the waist, knee-length trousers and bare feet — the backbone of the village.",
    tips: ["บทชาวบ้าน: ทักทาย ไหว้ และต่อราคากับแม่ค้า · Villager role: greets, wais and haggles with merchants"],
  },
  "chaoban-woman": {
    th: "แม่ค้าเกล้ามวยทัดดอกไม้ ใส่เสื้อลูกไม้ นุ่งผ้าถุงลายริ้ว เสียงเจื้อยแจ้วเรียกลูกค้าได้ทั้งตลาด",
    en: "A market woman with her hair in a flowered bun, a lace-edged blouse and a long striped pha thung, whose voice can call in customers across the whole market.",
    tips: ["บทแม่ค้า: จะเดินไปยืนข้างแผงตลาดหรืออาหาร · Merchant role: she walks to the nearest market or food stall", "เล่นกระโดดเชือกในฉากลานกีฬา · Skips rope in the Village games scene"],
  },
  dek: {
    th: "เด็กบ้านนาไว้ผมจุก พุงกลม ห้อยตะกรุดที่คอ นุ่งผ้าเตี่ยวสีแดง ซนไม่หยุดและอยากรู้อยากเห็นไปหมดทุกเรื่อง",
    en: "A village child with a topknot, round belly, an amulet on a cord and a red loincloth — never still, and curious about absolutely everything.",
    tips: ["บทผู้ติดตาม: เดินตามตัวหนังที่เลือกไว้ · Follower role: tags along behind the selected puppet", "ตัวเล็ก เหมาะกับบทขี้ขลาด · Small and perfect as a Scaredy-cat"],
  },

  // ================================================================ sheet props
  "reusi-cane": {
    th: "ไม้เท้าคู่กายของพ่อแก่ฤๅษี ว่ากันว่าลงอาคมไว้ ใช้ทั้งค้ำยันเดินป่าและปัดเป่าสิ่งชั่วร้าย",
    en: "The hermit's own walking staff, said to be charged with spells — a prop for forest walks and a ward against evil.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "อาวุธทื่อ: ทำให้ช้ำ ไม่ฉีกขาด · Blunt weapon: bruises rather than cuts"],
  },
  "reusi-pot": {
    th: "หม้อน้ำมนต์ของฤๅษี ตักน้ำจากลำธารในป่าหิมพานต์มาเสกเป็นน้ำศักดิ์สิทธิ์ ประพรมให้พรแก่ผู้มาเยือน",
    en: "The hermit's pot of holy water, drawn from a Himmaphan stream and blessed, for sprinkling good fortune on visitors.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "nang-fan": {
    th: "พัดของนางเอก ฉลุลายอ่อนช้อย ใช้โบกลมเย็นและบังหน้าเวลาเขินอาย",
    en: "The heroine's fan, cut with delicate lace, for a cool breeze or to hide a blush.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },

  // ================================================================ tools (fx)
  "fx-fire": {
    th: "กองฟืนลุกเป็นไฟจริง มีเปลว ควัน และประกายไฟพุ่งขึ้น ส่องแสงอุ่นไปทั่วจอ ไฟนี้ร้อนจริง ตัวหนังที่เข้าใกล้จะไหม้เกรียม",
    en: "A log fire with real flames, smoke and rising embers that warms the whole cloth with light. It is truly hot: puppets that stand in it get scorched.",
    tips: ["ตัวหนังใกล้ไฟจะไหม้และขาด · Puppets too close char and can lose limbs", "ยันต์คุ้มกันกันไฟได้ · A yantra ward protects from burning", "สัตว์จะเดินหนีกองไฟ · Animals keep away from fire"],
  },
  "fx-torch": {
    th: "คบเพลิงด้ามยาวที่ลุกโชนจริง ส่องทางในคืนมืดหรือใช้ขู่ศัตรูก็ได้",
    en: "A long-handled torch with a living flame, to light the way at night or to wave at an enemy.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "ไฟเผาตัวหนังอื่นได้ แต่ไม่เผาคนถือ · Burns other puppets, never its holder", "ใช้ตีได้แบบอาวุธทื่อ · Swings as a blunt weapon"],
  },
  "fx-smoke": {
    th: "กระถางธูปปักธูปสามดอก ควันหอมลอยม้วนขึ้นช้า ๆ เหมือนการบูชาครูก่อนเปิดโรง",
    en: "An incense burner with three sticks, fragrant smoke curling slowly upward like the offering made to the teachers before a show.",
    tips: ["ลมพัดควันเอียงไปตามทิศ · Wind bends the smoke"],
  },
  "fx-water": {
    th: "แถบสายน้ำกระเพื่อมยาวเหมือนลำคลอง ใช้ปูเป็นพื้นแม่น้ำหรือหน้าท่าน้ำ",
    en: "A long rippling band of water like a canal, for laying down a river or a landing stage.",
    tips: ["อยู่กับที่ ไม่ตกลงพื้น · Stays where you put it"],
  },
  "fx-fountain": {
    th: "น้ำพุในอ่างหิน พ่นละอองน้ำขึ้นแล้วร่วงลงเป็นหยดต่อเนื่อง เหมาะกับสวนในวัง",
    en: "A fountain in a stone basin, throwing up a steady spray of droplets — just right for a palace garden.",
  },
  "fx-light-gold": {
    th: "ดวงไฟสีทองอบอุ่นเหมือนแสงตะเกียงน้ำมัน ส่องให้จอหนังเรืองนวล",
    en: "A warm golden light like an oil lamp, making the cloth glow softly.",
    tips: ["ใช้จัดแสงฉาก · Use it to light a corner of the scene"],
  },
  "fx-light-red": {
    th: "ดวงไฟสีแดงเพลิง ให้บรรยากาศเดือดดาล เหมาะกับฉากยักษ์หรือเมืองไฟไหม้",
    en: "A fiery red light for a furious mood — demons, battles, or a city in flames.",
    tips: ["ใช้จัดแสงฉาก · Use it to light a corner of the scene"],
  },
  "fx-light-blue": {
    th: "ดวงไฟสีฟ้าคราม เย็นและลึกลับ เหมาะกับฉากกลางคืน วิญญาณ หรือใต้น้ำ",
    en: "A cool indigo-blue light, mysterious and calm — for night, ghosts, or underwater.",
    tips: ["ใช้จัดแสงฉาก · Use it to light a corner of the scene"],
  },
  "fx-light-green": {
    th: "ดวงไฟสีเขียว ให้แสงแปลกตาเหมือนป่าลึกหรือเวทมนตร์ของภูตผี",
    en: "An eerie green light, like deep jungle or a spirit's magic.",
    tips: ["ใช้จัดแสงฉาก · Use it to light a corner of the scene"],
  },
  "fx-magic": {
    th: "ดาวประกายเวทย์ที่โปรยแสงระยิบระยับรอบตัวไม่หยุด เหมาะกับฉากเทวดาเสด็จหรือของวิเศษ",
    en: "A charmed star that sheds endless twinkling sparks, for a deva's arrival or an enchanted object.",
  },

  // ================================================================ magic
  "mg-soul": {
    th: "คาถาปลุกเสกให้หนังมีวิญญาณ ตัวหนังจะรู้สึกเจ็บ เลือดออก ร้องไห้ และตายได้ หัวใจจะเรืองแสงเต้นตุบ ๆ อยู่กลางอก หากปลุกซ้ำอีกครั้งวิญญาณจะออกจากร่าง",
    en: "A spell that breathes a soul into the hide: the puppet can feel pain, bleed, weep and die, and a faint heart glows and beats in its chest. Cast it again and the soul leaves.",
    tips: ["วางบนตัวหนัง (หรือใกล้ ๆ) · Drop it on (or near) a puppet", "ตัวที่ไม่มีวิญญาณเป็นแค่หนัง โดนตีแรงก็ฉีก · Without a soul it is only hide: blows just tear it", "เสียเลือดมากเกินไปจะตาย · Lose too much blood and it dies"],
  },
  "mg-ward": {
    th: "ลงยันต์คุ้มกาย เกราะทองจะดูดซับแรงฟันแรงตีไว้ส่วนใหญ่จนกว่ายันต์จะหมดฤทธิ์ และกันไฟไม่ให้ไหม้ด้วย",
    en: "A protective yantra: a golden ward soaks up most of each blow until its power is spent, and keeps fire from scorching the puppet.",
    tips: ["วางบนตัวหนัง · Drop it on a puppet", "ยันต์ค่อย ๆ หมดเมื่อรับแรง · The ward wears down as it absorbs hits"],
  },
  "mg-mend": {
    th: "คาถาชุบชีวิต เย็บแขนขาที่ขาดกลับเข้าที่ สมานแผล ห้ามเลือด และปลุกตัวที่ตายแล้วให้ลุกขึ้นใหม่",
    en: "A spell of mending: torn-off limbs are stitched back on, wounds close, bleeding stops, and the fallen rise again.",
    tips: ["วางบนตัวหนังที่บาดเจ็บหรือตาย · Drop it on a wounded or dead puppet"],
  },
  "mg-summon": {
    th: "คาถาอัญเชิญ ลำแสงสวรรค์จะส่องลงมาแล้วสัตว์ ปีศาจ หรือตัวหนังตัวใดตัวหนึ่งจะปรากฏขึ้นโดยสุ่ม ปีศาจมาพร้อมควันสีม่วง",
    en: "A summoning: a shaft of heavenly light falls and a random beast, monster or puppet condenses out of it — monsters arrive in violet smoke.",
    tips: ["วางตรงจุดที่อยากให้ปรากฏ · Drop it where you want the arrival", "สุ่มทุกครั้ง · Different every time"],
  },

  // ================================================================ weather
  "wx-rain": {
    th: "ฝนตกพรำทั่วจอ หยดน้ำกระเซ็นที่พื้น สัตว์ส่วนใหญ่จะหยุดพักหลบฝน",
    en: "Rain falls across the whole cloth, splashing on the ground; most animals stop and rest it out.",
    tips: ["วางอีกครั้งเพื่อปิด · Drop again to turn it off", "รวมกับลมได้ · Combine with wind"],
  },
  "wx-storm": {
    th: "พายุฝนฟ้าคะนอง ฝนหนัก ลมกระโชก ฟ้าแลบฟ้าร้องเป็นระยะ ต้นไม้โยกรุนแรง สัตว์ขี้ตกใจวิ่งพล่าน",
    en: "A thunderstorm: heavy rain, gusting wind and lightning with thunder every few seconds. Trees thrash and timid animals panic.",
    tips: ["วางอีกครั้งเพื่อปิด · Drop again to turn it off", "ต้นไม้ลู่ลมแรงกว่าตอนลมพัดธรรมดา · Foliage sways harder than in plain wind"],
  },
  "wx-wind": {
    th: "ลมพัดแรง ใบไม้ปลิวข้ามจอ ควันเอียง และต้นไม้ลู่ไปตามลม จอผ้าก็พลิ้วไหวตามไปด้วย",
    en: "A strong wind: leaves blow across, smoke leans, trees bend, and the cloth itself ripples.",
    tips: ["วางอีกครั้งเพื่อปิด · Drop again to turn it off"],
  },
  "wx-flood": {
    th: "น้ำท่วมค่อย ๆ เอ่อขึ้นจากพื้น เรือและของลอยน้ำจะลอยขึ้นตาม สัตว์น้ำได้ว่ายเล่น สัตว์บกหนีไปหาที่ดอน",
    en: "Floodwater slowly rises from the floor. Boats and floating things rise with it; water animals swim while land animals head for the shore.",
    tips: ["วางอีกครั้งเพื่อให้น้ำลด · Drop again to let it drain", "จระเข้ล่าเหยื่อได้ไกลขึ้นตอนน้ำท่วม · Crocodiles hunt further in a flood"],
  },
  "wx-quake": {
    th: "แผ่นดินไหว ทุกอย่างบนจอสั่นโยกไปมา กล้องสั่น ตัวหนังและสิ่งของอาจล้มคว่ำ",
    en: "An earthquake shakes everything on the cloth back and forth; the view trembles and puppets and props may topple.",
    tips: ["วางอีกครั้งเพื่อหยุด · Drop again to stop it", "สัตว์ขี้ตกใจจะวิ่งพล่าน · Timid animals panic"],
  },
  "wx-dawn": {
    th: "แสงรุ่งอรุณสีชมพูอมส้ม อ่อนโยนเหมือนตลาดเช้า ใช้แทนแสงยามเย็นหรือราตรีได้ทันที",
    en: "Soft rosy-orange dawn light, gentle as an early market; it replaces dusk or moonlight.",
    tips: ["แสงเช้า เย็น ค่ำ เลือกได้ทีละอย่าง · Only one of dawn, dusk or night at a time"],
  },
  "wx-dusk": {
    th: "แสงยามเย็นสีส้มแดง บรรยากาศงานวัดเมื่อตะวันลับฟ้า",
    en: "Warm red-orange dusk, the mood of a temple fair as the sun goes down.",
    tips: ["แสงเช้า เย็น ค่ำ เลือกได้ทีละอย่าง · Only one of dawn, dusk or night at a time"],
  },
  "wx-night": {
    th: "แสงจันทร์สีฟ้าเย็น สัตว์ส่วนใหญ่หลับ แต่สัตว์กลางคืนอย่างเสือ แมว กบ และผีกระสือจะออกหากิน",
    en: "Cool blue moonlight. Most animals fall asleep, while night creatures — tigers, cats, frogs and the krasue — come out to prowl.",
    tips: ["วางอีกครั้งเพื่อปิด · Drop again to turn it off", "เสือที่หลับอยู่ไม่มีใครกลัว · A sleeping tiger frightens no one"],
  },

  // ================================================================ weapons
  dab: {
    th: "ดาบไทยใบโค้งคมด้านเดียว ด้ามพันเชือก ปลอกโคนประดับลายกระจัง เป็นอาวุธคู่กายของนักรบไทยและศิลปะกระบี่กระบอง",
    en: "The Thai daab: a gently curved single-edged sword with a cord-wrapped hilt and a gilt krajang leaf at the root, the classic blade of Thai warriors and krabi-krabong.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "อาวุธมีคม: ฟันแล้วหนังฉีกขาด · Blade: slashes open ragged cuts", "ฟันโดนตัวที่มีวิญญาณ ดาบจะเปื้อนเลือด · It comes away bloody from living hide"],
  },
  "dab-kap": {
    th: "ดาบด้ามยาวจับได้สองมือ ใบยาว มีร่องเลือดคู่ เหมาะกับการฟันหนัก ๆ ระยะไกลกว่าดาบธรรมดา",
    en: "A long-hilted two-handed sword with twin fullers, made for heavy cuts at longer reach than the daab.",
    tips: ["อาวุธมีคม · Blade", "ระยะเอื้อมยาว · Long reach"],
  },
  ngao: {
    th: "ง้าว อาวุธด้ามยาวใบโค้งใหญ่ปลายเป็นกนกเปลว นักรบบนหลังช้างใช้ฟันในยุทธหัตถี เป็นอาวุธของยักษ์และแม่ทัพ",
    en: "The ngao glaive: a great crescent blade on a long pole with a flame hook, swung from elephant-back in royal duels — a weapon for demons and generals.",
    tips: ["อาวุธมีคมระยะไกล · Long-reach blade", "ยักษ์ถือง้าวในฉากศึกลงกา · The demon wields it at Lanka"],
  },
  hok: {
    th: "หอกใบรูปใบไม้ มีพู่แดงใต้ปลอก ด้ามยาว ใช้แทงจากระยะไกล เป็นอาวุธของทหารราบมาแต่โบราณ",
    en: "A spear with a leaf-shaped head and a red tassel, for thrusting from a distance — the old weapon of the foot soldier.",
    tips: ["อาวุธปลายแหลม: แทงเป็นแผลลึก · Point: pierces deep wounds", "เหมาะกับท่าแทง (ปุ่ม 2) · Best with the lunge (key 2)"],
  },
  kris: {
    th: "กริชใบคดเจ็ดลูก ด้ามแบบปัตตานีงอนเป็นจะงอยนก อาวุธศักดิ์สิทธิ์ของคาบสมุทรมลายูและภาคใต้ เชื่อกันว่ากริชดีมีวิญญาณสิงอยู่",
    en: "A wavy seven-curve kris with a Pattani-style bird-beak hilt — the sacred dagger of the Malay peninsula and the Thai south, where a fine kris is said to have a spirit of its own.",
    tips: ["อาวุธปลายแหลม ระยะสั้น · Short point weapon"],
  },
  knife: {
    th: "มีดพร้าใบกว้างปลายงุ้ม เครื่องมือประจำบ้านชาวนาที่ใช้ทั้งถางหญ้า ผ่าไม้ไผ่ และป้องกันตัว",
    en: "The meed prah machete, broad with a hooked beak — every farmhouse's tool for clearing grass, splitting bamboo and, when needed, self-defence.",
    tips: ["อาวุธมีคม · Blade", "หนูนุ้ยและสะหม้อถือติดตัว · Nu Nui and Samor carry one"],
  },
  bow: {
    th: "ธนูไทยคันโค้งกลับ ปลายเป็นกนกเปลวรูปนาค อาวุธของพระรามผู้ยิงศรได้แม่นราวมีเวท",
    en: "A Thai recurved bow with naga-flame finials — the weapon of Rama, whose arrows fly as if by magic.",
    tips: ["ในเกมนี้ใช้ฟาดแบบอาวุธทื่อ · In this game it swings as a blunt weapon", "คู่กับศรให้พระเอก · Pair it with an arrow for the prince"],
  },
  arrow: {
    th: "ศรหัวเปลวมีเงี่ยง ขนหางสองแฉก ในรามเกียรติ์ศรของพระรามคืออาวุธวิเศษที่ปราบทศกัณฐ์ได้",
    en: "An arrow with a barbed flame head and twin vanes; in the Ramakien, Rama's arrows are divine weapons that finally fell Thotsakan.",
    tips: ["ถือแทงได้แบบอาวุธปลายแหลม · Held, it stabs as a point weapon"],
  },
  shield: {
    th: "โล่กลมลายกระจังและประจำยาม ใช้กันคมดาบในกระบี่กระบอง คู่กับดาบมือเดียว",
    en: "A round shield painted with krajang and prajam motifs, used to turn aside blades in krabi-krabong alongside a single sword.",
    tips: ["ถือมือหลังคู่ดาบ · Hold it in the back hand with a sword", "ตีได้แบบอาวุธทื่อ · Bashes as a blunt weapon"],
  },
  gada: {
    th: "กระบองยักษ์หัวหนามทรงบัว หนักและน่ากลัว ตีทีเดียวสะเทือนไปทั้งตัว อาวุธประจำตัวของเหล่ายักษ์",
    en: "The demon's krabong club with a spiked lotus-bulb head, heavy and fearsome — one blow shakes the whole body.",
    tips: ["อาวุธทื่อ: ทำให้ช้ำ ไม่ฉีก · Blunt: bruises, doesn't cut", "หนักกว่าอาวุธอื่น · Heavier than other weapons"],
  },
  staff: {
    th: "ไม้พลองยาวคาดปลอกทองเป็นระยะ อาวุธฝึกของกระบี่กระบอง ใช้ได้ทั้งตี ปัด และค้ำ",
    en: "The plong: a long fighting staff ringed with gilt bands, a krabi-krabong training weapon for striking, parrying and vaulting.",
    tips: ["อาวุธทื่อระยะยาว · Long blunt weapon"],
  },
  trident: {
    th: "ตรีศูลสามง่าม อาวุธของพระอิศวร ในหนังและโขนมักอยู่ในมือเทพหรือยักษ์ผู้มีฤทธิ์",
    en: "The trisula, three-pronged weapon of Shiva, carried by gods and mighty demons in shadow play and khon.",
    tips: ["อาวุธปลายแหลม · Point weapon"],
  },
  chakra: {
    th: "จักรวงล้อขอบเป็นเปลวไฟหมุน อาวุธของพระนารายณ์ที่ขว้างแล้วกลับคืนมือ ในเกมนี้ถือฟันด้วยขอบคม",
    en: "The chakra, Vishnu's spinning discus with a rim of flames that returns to his hand; here you hold it and slash with its edge.",
    tips: ["อาวุธมีคม · Blade"],
  },

  // ================================================================ food
  "banana-bunch": {
    th: "กล้วยหวีใหญ่ทั้งเครือ ผลไม้ที่มีทุกบ้าน ใช้ทั้งกิน ทำขนม และใบตองห่อของ",
    en: "A whole bunch of bananas — in every Thai home, eaten fresh, cooked into sweets, with the leaves used for wrapping.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "แม่ค้าจะมายืนขายข้างอาหาร · A merchant will set up beside food"],
  },
  coconut: {
    th: "มะพร้าวลูกเขียว เจาะดื่มน้ำหวานชื่นใจ เนื้อขูดทำกะทิ หัวใจของอาหารไทย",
    en: "A green coconut: sweet water to drink, and flesh grated into coconut milk, the heart of Thai cooking.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  durian: {
    th: "ทุเรียน ราชาแห่งผลไม้ หนามแหลม กลิ่นแรงจนบางคนหลงรักบางคนหนี ราคาก็สูงขึ้นทุกปี",
    en: "Durian, king of fruits — spiky, and so pungent that people either adore it or flee. Pricier every year, as the villagers complain.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  mango: {
    th: "มะม่วงสุกเหลืองหอม กินคู่ข้าวเหนียวมูนเป็นของหวานที่ทั้งโลกรู้จัก",
    en: "A ripe yellow mango, famous worldwide with sweet coconut sticky rice.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  mangosteen: {
    th: "มังคุด ราชินีแห่งผลไม้ เปลือกม่วงเข้ม เนื้อขาวหวานอมเปรี้ยว นับกลีบได้จากรอยที่ก้น",
    en: "Mangosteen, queen of fruits: deep purple rind, sweet-sour white segments — the flower at its base tells you how many.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  pineapple: {
    th: "สับปะรดหนามตาถี่ มงกุฎใบแข็ง หวานฉ่ำ ปลูกมากที่ภูเก็ตและประจวบฯ",
    en: "A pineapple with its crown of stiff leaves, sweet and juicy, grown famously in Phuket and Prachuap.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "pla-tu-basket": {
    th: "เข่งปลาทูหน้างอคอหัก เรียงในเข่งไม้ไผ่ใบเล็ก กินกับน้ำพริกกะปิคือมื้ออร่อยของคนไทย",
    en: "Pla tu mackerel in little bamboo baskets, heads bent to fit — with shrimp-paste chilli dip, a classic Thai meal.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "kai-yang": {
    th: "ไก่ย่างหนีบไม้ไผ่ ย่างบนเตาถ่านจนหนังกรอบหอม คู่กับส้มตำและข้าวเหนียวแบบอีสาน",
    en: "Grilled chicken clamped in split bamboo and roasted over charcoal, best with som tam and sticky rice, Isan style.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  krathip: {
    th: "กระติ๊บสานจากไม้ไผ่ใส่ข้าวเหนียว เก็บความร้อนให้ข้าวนุ่มทั้งวัน ชาวอีสานและล้านนาใช้ทุกมื้อ",
    en: "A woven bamboo krathip that keeps sticky rice soft and warm all day — at every meal in Isan and Lanna.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "krok-somtam": {
    th: "ครกดินกับสากไม้สำหรับตำส้มตำ ได้ยินเสียงโป๊ก ๆ ก็รู้ว่าแม่ค้ากำลังตำมะละกอ",
    en: "A clay mortar and wooden pestle for pounding som tam — hear the 'pok pok' and you know the papaya salad is on.",
  },
  "noodle-bowl": {
    th: "ชามก๋วยเตี๋ยวลายไก่ ชามสามัญประจำร้านเส้นทั่วประเทศ น้ำซุปร้อน ๆ ควันลอยกรุ่น",
    en: "A bowl of noodles in the classic rooster bowl found in every noodle shop in the land, steaming hot.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  watermelon: {
    th: "แตงโมชิ้นสามเหลี่ยม เนื้อแดงเม็ดดำ คลายร้อนกลางหน้าร้อน",
    en: "A wedge of watermelon, red flesh and black seeds, to beat the hot-season heat.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "luk-chin-ping": {
    th: "ลูกชิ้นปิ้งเสียบไม้ ราดน้ำจิ้มหวานเผ็ด ของกินเล่นยอดฮิตหน้าโรงเรียนและงานวัด",
    en: "Grilled meatball skewers with sweet-spicy sauce, the favourite snack outside schools and at temple fairs.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },

  // ================================================================ market
  "phaeng-loi": {
    th: "แผงลอยไม้ขายของริมทาง วางสินค้าเรียงราย มีผ้าใบกันแดด ภาพคุ้นตาของตลาดไทย",
    en: "A wooden roadside stall with goods laid out under an awning, a familiar sight in every Thai market.",
    tips: ["ตั้งอยู่กับที่ · Stands fixed in place", "ให้ตัวหนังบทแม่ค้ามายืนขาย · A Merchant-role puppet will come and sell here"],
  },
  "rom-mae-kha": {
    th: "ร่มผ้าใบคันใหญ่ของแม่ค้า กางกันแดดกันฝนเหนือแผง ตลาดไหนก็มีร่มหลากสีแบบนี้",
    en: "The big vendor's umbrella, shading a stall from sun and rain — every market blooms with them.",
    tips: ["ตั้งอยู่กับที่ · Stands fixed in place", "แม่ค้าจะมายืนข้างร่ม · Merchants gather beside it"],
  },
  "haap-re": {
    th: "ไม้คานหาบกระจาดสองข้าง แม่ค้าหาบเร่เดินขายไปทั่วซอย เสียงร้องเรียกลูกค้าดังมาแต่ไกล",
    en: "A carrying pole with two baskets — the hawker who walks the lanes calling out wares from afar.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "rot-khen-kuaytiao": {
    th: "รถเข็นก๋วยเตี๋ยวมีหม้อน้ำซุปและตู้กระจกใส่เส้น เข็นขายตามหมู่บ้านและหน้าตลาด",
    en: "A noodle cart with its soup pot and glass case of noodles, pushed through villages and market fronts.",
    tips: ["แม่ค้าจะมายืนขายข้างรถเข็น · Merchants set up beside it"],
  },
  "tachang-jin": {
    th: "ตาชั่งจีนคานยาว มีลูกตุ้มเลื่อนหาน้ำหนัก ใช้ชั่งของในตลาดมาแต่สมัยก่อน",
    en: "A Chinese steelyard with a sliding weight, the market scale of old times.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  krachat: {
    th: "กระจาดสานใบแบน วางผักผลไม้หรือขนมเรียงให้ลูกค้าเลือก",
    en: "A flat woven tray for laying out vegetables, fruit or sweets for customers to choose.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "pai-raan": {
    th: "ป้ายร้านเขียนว่า “ของดี ราคาถูก” คำสัญญาที่แม่ค้าทุกร้านพูดเหมือนกัน",
    en: "A shop sign reading “Good stuff, cheap!” — the promise every vendor makes.",
  },
  kheng: {
    th: "เข่งไม้ไผ่สานโปร่ง ใช้ใส่ผัก ผลไม้ หรือไก่ ขนส่งจากสวนเข้าตลาด",
    en: "An open-weave bamboo crate for carrying vegetables, fruit or poultry from farm to market.",
  },
  "takra-khai": {
    th: "ตะกร้าใส่ไข่ไก่ไข่เป็ดเต็มใบ หิ้วไปขายที่ตลาดเช้า ต้องถือระวังไม่ให้แตก",
    en: "A basket full of hen and duck eggs carried to the morning market — handle with care.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "phuang-malai": {
    th: "พวงมาลัยมะลิร้อยด้วยมือ ห้อยอุบะดอกไม้ ใช้ไหว้พระ บูชาศาลพระภูมิ หรือมอบให้ผู้ใหญ่",
    en: "A hand-threaded jasmine garland with tassels of flowers, offered to the Buddha, the spirit house or a respected elder.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "ท่าสอดสร้อยมาลาได้ชื่อจากการร้อยมาลัย · The dance “Threading the garland” is named for this"],
  },

  // ================================================================ household
  "ong-mangkon": {
    th: "โอ่งมังกรเคลือบสีน้ำตาลจากราชบุรี มีลายมังกรพันรอบ ใช้รองน้ำฝนไว้ใช้ทั้งปี",
    en: "A glazed brown dragon jar from Ratchaburi, a dragon coiled around it, for storing rainwater through the year.",
  },
  "ong-din": {
    th: "โอ่งดินเผาใส่น้ำดื่มพร้อมกระบวยตัก วางไว้หน้าบ้านให้คนเดินผ่านได้ดื่มดับกระหาย",
    en: "An earthen water jar with a dipper, set out front so passers-by can drink.",
  },
  "takiang-jaophayu": {
    th: "ตะเกียงเจ้าพายุ อัดลมให้ไส้ผ้าสว่างจ้า ทนลมแรง ใช้กันในงานวัดและโรงหนังตะลุงสมัยก่อน",
    en: "A pressure lantern whose pumped mantle burns bright even in strong wind — once the light of temple fairs and shadow-play stages.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "ส่องแสงบนจอ · Casts light on the cloth"],
  },
  "takiang-namman": {
    th: "ตะเกียงน้ำมันก๊าดดวงเล็ก แสงเหลืองนวลวอมแวม ส่องบ้านไทยยามค่ำก่อนมีไฟฟ้า",
    en: "A small kerosene lamp with a soft flickering glow that lit Thai homes before electricity.",
    tips: ["ส่องแสงบนจอ · Casts light on the cloth"],
  },
  "tao-than": {
    th: "เตาถ่านอั้งโล่ดินเผา ถ่านแดงเรืองอยู่ข้างใน ใช้หุงข้าว ต้มแกง และปิ้งย่าง",
    en: "A clay tao ang-lo charcoal stove with coals glowing inside, for rice, curries and grilling.",
    tips: ["ส่องแสงแดงเรือง แต่ไม่เผาตัวหนัง · Glows red, but doesn't burn puppets"],
  },
  "mo-din": {
    th: "หม้อดินเผาวางบนเสวียนหวาย ต้มแกงส้มหรือยาสมุนไพรได้รสชาติกลมกล่อม",
    en: "A clay cooking pot on a rattan ring, said to make curries and herbal brews taste rounder.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "mai-kwat": {
    th: "ไม้กวาดดอกหญ้า มัดจากดอกหญ้าแห้ง กวาดลานบ้านและลานวัดทุกเช้า",
    en: "A broom of dried grass flowers, for sweeping house yards and temple courts each morning.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  tang: {
    th: "ตั่งไม้เตี้ยแกะสลัก ใช้วางพานบูชาหรือนั่งพักแบบไทยโบราณ",
    en: "A low carved table for an offering tray, or for sitting in the old Thai way.",
  },
  "ma-nang": {
    th: "ม้านั่งไม้ยาว ตั้งหน้าบ้านหรือใต้ต้นไม้ ที่นั่งคุยกันของคนในหมู่บ้าน",
    en: "A long wooden bench in front of a house or under a tree, where neighbours sit and chat.",
  },
  "phat-bai-tan": {
    th: "พัดสานจากใบตาล ด้ามไม้ไผ่ เบาและเย็น ใช้โบกคลายร้อนหรือพัดไฟเตาถ่าน",
    en: "A fan woven from sugar-palm leaf on a bamboo handle — light, cooling, and good for fanning a charcoal stove.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "rom-kradat": {
    th: "ร่มกระดาษสาบ่อสร้าง เชียงใหม่ วาดลายดอกไม้ด้วยมือ งานหัตถกรรมขึ้นชื่อของล้านนา",
    en: "A hand-painted Bo Sang paper umbrella from Chiang Mai, a famous Lanna craft.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  krabung: {
    th: "กระบุงสานไม้ไผ่ ก้นสี่เหลี่ยมปากกลม ใช้ใส่ข้าวเปลือกหรือผลผลิตจากไร่ หาบคู่กับไม้คาน",
    en: "A woven bamboo krabung, square-bottomed and round-mouthed, for paddy or produce, carried in pairs on a pole.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "khan-thai": {
    th: "คันไถไม้ให้ควายลาก พลิกหน้าดินก่อนดำนา เครื่องมือที่อยู่คู่ชาวนาไทยมาหลายร้อยปี",
    en: "A wooden plough drawn by a buffalo to turn the soil before transplanting rice, the farmer's companion for centuries.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "kao-i-mai": {
    th: "เก้าอี้ไม้เรียบง่าย ตั้งหน้าบ้านหรือร้านกาแฟโบราณ",
    en: "A plain wooden chair, at a house front or an old-style coffee shop.",
  },
  "khrae-mai-phai": {
    th: "แคร่ไม้ไผ่ ตั้งใต้ถุนบ้านหรือร่มไม้ ใช้นั่งเล่น นอนกลางวัน และกินข้าวร่วมกัน",
    en: "A bamboo khrae platform under the house or a shady tree, for lounging, napping and sharing meals.",
  },
  "tu-phra-tham": {
    th: "ตู้พระธรรมลายรดน้ำปิดทอง ใช้เก็บคัมภีร์ใบลานในวัด งานช่างชั้นสูงของไทย",
    en: "A gold-on-black lacquered scripture cabinet that keeps palm-leaf manuscripts in a temple, a masterpiece of Thai craft.",
  },
  "ong-nam-mon": {
    th: "โอ่งน้ำมนต์ปักดอกบัว พระสวดเสกไว้ให้ญาติโยมตักประพรมเป็นสิริมงคล",
    en: "A holy-water jar topped with lotus, blessed by monks for people to sprinkle on themselves for good luck.",
  },
  "khom-loi": {
    th: "โคมลอยกระดาษสา จุดไฟแล้วปล่อยลอยขึ้นฟ้าในงานยี่เป็งเพื่อปล่อยทุกข์โศก ในเกมนี้มันลอยค้างอยู่กลางอากาศและเรืองแสง",
    en: "A paper sky lantern, released at the Yi Peng festival to carry sorrows away. Here it hovers where you leave it, glowing.",
    tips: ["ลอยอยู่กลางอากาศ · Floats in the air", "วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  krathong: {
    th: "กระทงใบตองประดับดอกไม้ ธูปเทียน ลอยในคืนวันเพ็ญเดือนสิบสองเพื่อขอขมาพระแม่คงคา",
    en: "A banana-leaf krathong with flowers, incense and a candle, floated on the full moon of the twelfth month to thank the water goddess.",
    tips: ["ลอยน้ำ: น้ำท่วมแล้วจะลอยขึ้นตาม · Floats, and rises with a flood", "เรืองแสงเทียน · Glows with candlelight"],
  },
  "rom-chat": {
    th: "ฉัตรซ้อนชั้น เครื่องสูงแสดงพระเกียรติยศ ใช้กางกั้นพระมหากษัตริย์และพระพุทธรูป",
    en: "A tiered royal umbrella, the high regalia held over kings and Buddha images.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "ให้พญาถือเพื่อความสง่า · Give it to the king"],
  },

  // ================================================================ instruments
  "ranat-ek": {
    th: "ระนาดเอก ผืนลูกระนาดไม้วางบนรางรูปเรือ เป็นเครื่องนำวงปี่พาทย์ ผู้ตีต้องฝีมือเร็วและแม่นที่สุดในวง",
    en: "The ranat ek, a boat-shaped xylophone of hardwood bars that leads the piphat ensemble — its player must be the fastest and surest in the band.",
    tips: ["คลิกหรือลากเพื่อตี: ไล่ทำนองไปเรื่อย ๆ · Click or drag to play a wandering melody"],
  },
  "khong-wong": {
    th: "ฆ้องวง ลูกฆ้องเรียงเป็นวงล้อมรอบผู้ตี เสียงกังวาน เป็นแกนทำนองหลักของวงปี่พาทย์",
    en: "The khong wong, a circle of tuned gongs around the seated player, ringing out the core melody of the piphat ensemble.",
    tips: ["คลิกหรือลากเพื่อตี: เสียงฆ้องไล่ทำนอง · Click or drag for ringing melodic notes"],
  },
  "klong-that": {
    th: "กลองทัด กลองถังหน้าหนังขึงหมุด ตีด้วยไม้คู่ ให้จังหวะหนักแน่นในวงปี่พาทย์และการแสดงโขน",
    en: "The klong that, a pegged barrel drum struck with sticks, giving the piphat ensemble and khon its weighty beat.",
    tips: ["คลิกเพื่อตี: สลับเสียงสูงต่ำ · Click to play, alternating high and low strokes"],
  },
  thap: {
    th: "ทับ กลองคู่ทรงถ้วยหัวใจของวงหนังตะลุง (ทับพ่อ ทับแม่) คนตีทับเป็นผู้คุมจังหวะให้นายหนังเชิดตาม",
    en: "The thap, the pair of goblet drums at the heart of the nang talung band; the thap player sets the rhythm the puppeteer follows.",
    tips: ["คลิกเพื่อตี: ต้อง ติ้ง ตุ๊ก วนไป · Click for tong, ting and tuk strokes in turn"],
  },
  mong: {
    th: "โหม่งคู่แขวนในกล่องไม้ เสียงทุ้มสองระดับ ตีบอกจังหวะหนักในวงหนังตะลุงภาคใต้",
    en: "A pair of gongs hung in a wooden box, two deep tones marking the strong beats of the southern shadow-play band.",
    tips: ["คลิกเพื่อตี: สลับเสียงฆ้องสองลูก · Click to alternate the two gongs"],
  },
  ching: {
    th: "ฉิ่งคู่โลหะ ตีกระทบกันเป็นเสียง ฉิ่ง และ ฉับ คอยกำกับจังหวะให้ทั้งวง",
    en: "Small paired cymbals sounding “ching” and “chap”, keeping time for the whole ensemble.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อตี ฉิ่ง-ฉับ · Click for ching, then chap"],
  },
  khlui: {
    th: "ขลุ่ยไม้ไผ่เป่าตรง เสียงหวานโหยหวน เป็นเสียงของท้องทุ่งและความคิดถึง",
    en: "A bamboo fipple flute with a sweet, wistful voice — the sound of open fields and longing.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อเป่าทีละโน้ต · Click to play a note"],
  },
  khaen: {
    th: "แคน เครื่องเป่าลิ้นโลหะต่อจากลำไม้กู่แคนของชาวอีสานและลาว เป่าได้หลายเสียงพร้อมกัน ยูเนสโกยกย่องเป็นมรดกโลก",
    en: "The khaen, the bamboo mouth organ of Isan and Laos with free metal reeds, playing chords and drones at once — recognised by UNESCO as world heritage.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อเป่าเป็นคอร์ด · Click for a full chord"],
  },
  "saw-duang": {
    th: "ซอด้วง ซอสองสายเสียงแหลม กระบอกขึงหนังงู สีด้วยคันชักที่สอดอยู่ระหว่างสาย",
    en: "The saw duang, a high two-string fiddle with a snakeskin-covered tube, its bow threaded between the strings.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อสีทีละโน้ต · Click to bow a note"],
  },
  "pi-nai": {
    th: "ปี่ใน ลิ้นสี่ชั้น เสียงแหลมเหมือนคนร้องไห้ คนเป่าใช้ระบายลมหายใจวนไม่ให้เสียงขาด ในหนังตะลุงปี่คือเสียงนำทำนอง",
    en: "The pi, a quadruple-reed oboe with a piercing, crying voice; players breathe in circles so the sound never breaks. In shadow play it carries the melody.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อเป่าทีละโน้ต · Click to play a note"],
  },
  jakhe: {
    th: "จะเข้ พิณสามสายวางกับพื้น รูปร่างคล้ายจระเข้จึงได้ชื่อนี้ ดีดด้วยไม้ดีดงาช้างพันนิ้ว",
    en: "The jakhe, a three-string floor zither named for its crocodile shape, plucked with a plectrum tied to the finger.",
    tips: ["คลิกเพื่อดีดไล่ทำนอง · Click to pluck a wandering melody"],
  },
  krap: {
    th: "กรับพวง ไม้บางหลายแผ่นร้อยรวมกัน กระทบเป็นเสียงกรับ ใช้ในวงหนังตะลุงและเพลงเสภา",
    en: "The krap phuang, a bundle of thin slats that clap together — heard in shadow-play bands and sepha recitation.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "คลิกเพื่อตีกรับ · Click to clap"],
  },
  rakhang: {
    th: "ระฆังวัดหล่อด้วยสำริด ตีบอกเวลาทำวัตรเช้าเย็น เสียงก้องไปทั้งหมู่บ้าน",
    en: "A bronze temple bell rung for morning and evening chanting, its tone carrying across the whole village.",
    tips: ["คลิกเพื่อตีเสียงก้อง · Click to strike it", "วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },

  // ================================================================ animals
  kwai: {
    th: "ควายไทยเขาโค้งเสี้ยวพระจันทร์ เพื่อนคู่ทุกข์คู่ยากของชาวนา ไถนาด้วยกันมาหลายร้อยปี ชอบแช่โคลนแช่น้ำ",
    en: "A Thai water buffalo with crescent horns, the rice farmer's faithful partner for centuries, happiest wallowing in mud and water.",
    tips: ["เดินช้า อยู่เป็นฝูงวัวควาย · Slow, keeps with its herd", "ว่ายน้ำได้ตอนน้ำท่วม · Swims in a flood", "ลูกควายจะเดินตามแม่ · A calf follows it"],
  },
  "wua-khao": {
    th: "พระโคขาวในพระราชพิธีพืชมงคลจรดพระนังคัลแรกนาขวัญ เสี่ยงทายกินของเจ็ดอย่างเพื่อทำนายฟ้าฝนและผลผลิตปีนั้น",
    en: "The white ox of the Royal Ploughing Ceremony, which chooses among seven foods to foretell the year's rain and harvest.",
    tips: ["อยู่ฝูงเดียวกับควาย · Herds with buffalo", "ลูกควายตามแม่วัวขาวได้ · A buffalo calf may follow it"],
  },
  chang: {
    th: "ช้างไทยสัตว์ประจำชาติ ฉลาด ใจดี และแข็งแรง เคยทั้งลากซุงและออกศึก ตัวใหญ่จนแทบไม่กลัวใคร",
    en: "The Thai elephant, the national animal — wise, gentle and immensely strong, once a log-hauler and war mount. So big it fears almost nothing.",
    tips: ["ใจกล้า ไม่ค่อยตกใจ · Very bold", "ลงเล่นน้ำได้ · Takes to water", "ลูกช้างจะเดินตาม · A baby elephant follows it"],
  },
  "chang-song": {
    th: "ช้างทรงแต่งเครื่องคชาภรณ์ ผ้าปักทองและพู่ห้อย เป็นพาหนะของพระมหากษัตริย์ในพระราชพิธีและการศึก",
    en: "A royal elephant in full caparison — gold-embroidered cloths and tassels — the king's mount in ceremony and war.",
    tips: ["สงบนิ่ง แทบไม่ตกใจ · Calm and almost fearless", "ลูกช้างตามแม่ได้ · A baby elephant may follow it"],
  },
  mu: {
    th: "หมูบ้านจมูกดุ๊กดิ๊ก ชอบคุ้ยดินหาของกิน กินได้ทุกอย่าง และค่อนข้างขี้ตกใจ",
    en: "A farmyard pig with a twitchy snout, rooting for anything edible — and rather easily startled.",
    tips: ["กินไม่เลือก ชอบคุ้ยหากิน · Omnivore, often forages", "หนีเมื่อมีเสียงตีกัน · Runs from fights"],
  },
  "kai-chon": {
    th: "ไก่ชนพันธุ์ไทยหางยาวสง่า ใจสู้ กีฬาชนไก่มีมาแต่โบราณ ว่ากันว่าพระนเรศวรเคยชนไก่ชนะไก่ของพม่า",
    en: "A proud Thai fighting cock with a sweeping tail. Cockfighting is ancient here — legend says King Naresuan's rooster beat the Burmese prince's.",
    tips: ["เจอไก่ชนอีกตัวจะเข้าตีกัน · Two fighting cocks will square off", "หมาไทยชอบไล่ไก่ · Dogs chase chickens"],
  },
  "mae-kai": {
    th: "แม่ไก่ขี้ตกใจ คุ้ยเขี่ยหาอาหารในลานบ้าน มีลูกเจี๊ยบวิ่งตามต้อย ๆ",
    en: "A nervous mother hen scratching about the yard, chicks trotting behind her.",
    tips: ["ลูกเจี๊ยบเดินตามแม่ไก่ · Chicks follow her", "กลัวหมาและหนีง่าย · Flees dogs easily"],
  },
  "luk-kai": {
    th: "ลูกเจี๊ยบตัวกลมปุกปุย ร้องเจี๊ยบ ๆ ขี้กลัวที่สุดในลานบ้าน",
    en: "A round fluffy chick, peeping away, the most timid creature in the yard.",
    tips: ["วิ่งตามแม่ไก่หรือไก่แจ้ · Follows a hen or bantam", "แมวและหมาทำให้มันหนี · Cats and dogs send it running"],
  },
  pet: {
    th: "เป็ดบ้านเดินเตาะแตะ ชอบลงน้ำ ส่งเสียงก๊าบ ๆ เป็นฝูงในบึงและคลอง",
    en: "A waddling farm duck that loves the water, quacking in flocks on ponds and canals.",
    tips: ["ว่ายน้ำตอนน้ำท่วม · Swims in a flood", "อยู่ฝูงกับห่าน · Flocks with geese"],
  },
  "ma-thai": {
    th: "หมาไทยหลังอาน ขนแนวย้อนกลางหลัง ฉลาดและซื่อสัตย์ เห่าไล่ปีศาจ ยักษ์ และชอบวิ่งไล่ไก่กับแมว",
    en: "A Thai Ridgeback with the reversed stripe of fur down its back — clever and loyal, barking at monsters and demons and chasing chickens and cats.",
    tips: ["เห่าใส่ปีศาจและยักษ์ · Barks at monsters and demons", "ชอบวิ่งไล่ไก่และแมว กระต่ายก็กลัว · Chases chickens and cats; rabbits fear it too", "แทบไม่กลัวอะไร · Very bold"],
  },
  "maeo-wichianmat": {
    th: "แมววิเชียรมาศ แมวไทยโบราณตาสีฟ้า ขนครีมแต้มสีเข้มที่หน้า หู ขา และหาง ปรากฏในสมุดข่อยตำราแมวสมัยอยุธยา",
    en: "The Wichien Maat, Siam's ancient blue-eyed cat with dark points on face, ears, legs and tail, recorded in the Ayutthaya-era Cat Book Poems.",
    tips: ["ออกหากินกลางคืน · Nocturnal", "ลูกเจี๊ยบและกบกลัวมัน · Chicks and frogs fear it", "กลัวหมา · Scared of dogs"],
  },
  ma: {
    th: "ม้าทรงสง่าแต่งเครื่องประดับ วิ่งเร็วและขี้ตื่น เป็นพาหนะของพระเอกในนิทานจักร ๆ วงศ์ ๆ",
    en: "A fine royal horse in ornaments, swift and skittish, the hero's steed in royal folk tales.",
    tips: ["วิ่งเร็วมาก · Very fast runner", "ตกใจง่าย · Startles easily"],
  },
  ling: {
    th: "ลิงแสมซุกซน กระโดดไปมา ชอบเข้าไปกวนตัวหนัง ส่งเสียงเจี๊ยก ๆ เหมือนเหล่าวานรในกองทัพพระราม",
    en: "A cheeky macaque that hops about and loves to pester the puppets, ook-ooking like a soldier of Rama's monkey army.",
    tips: ["ชอบไปกระโดดวนรอบตัวหนัง · Hops around and pesters puppets", "กินไม่เลือก · Omnivore"],
  },
  "pla-chon": {
    th: "ปลาช่อน ปลาน้ำจืดตัวยาวลายเข้ม ว่ายเร็วในบึงและนาข้าว ปิ้งหรือทำต้มยำอร่อยนัก",
    en: "A snakehead, the long dark-marked freshwater fish darting through ponds and paddies — delicious grilled or in tom yam.",
    tips: ["ว่ายอยู่ในน้ำ · Lives in the water"],
  },
  "pla-thong": {
    th: "ปลาทองครีบพลิ้ว ว่ายช้า ๆ ในโอ่งหรือบ่อหน้าบ้าน เชื่อกันว่านำโชคลาภมาให้",
    en: "A goldfish with flowing fins, drifting in a jar or garden pond, believed to bring good fortune.",
    tips: ["ว่ายอยู่ในน้ำ · Lives in the water", "ขี้ตกใจ · Easily startled"],
  },

  // ================================================================ livestock & wild animals
  "moo-deng": {
    th: "หมูเด้ง ฮิปโปแคระตัวน้อยจากสวนสัตว์เปิดเขาเขียว ชลบุรี ที่โด่งดังไปทั่วโลกเมื่อปี ๒๕๖๗ ด้วยความแสบ ดื้อ เด้งดึ๋ง และชอบงับคนเลี้ยง",
    en: "Moo Deng, the baby pygmy hippo of Khao Kheow Open Zoo in Chonburi who became a worldwide sensation in 2024 for being sassy, bouncy, stubborn and fond of nibbling her keepers.",
    tips: ["ชอบวิ่งซิ่ง กระเด้ง และงับขาตัวหนัง · Gets the zoomies, bounces and nibbles puppets' legs", "เดินตามแม่ฮิปโป · Follows her mother hippo", "ว่ายน้ำตอนน้ำท่วม · Swims in a flood"],
  },
  hippo: {
    th: "แม่ฮิปโปแคระ ตัวใหญ่ใจเย็น ชอบแช่น้ำแช่โคลน คอยดูแลลูกที่ซนไม่หยุดอย่างหมูเด้ง",
    en: "A mother pygmy hippo, large and unflappable, who loves soaking in water and mud while keeping an eye on a restless baby like Moo Deng.",
    tips: ["หมูเด้งจะวิ่งตามแม่ · Moo Deng follows her", "ว่ายน้ำได้ · Swims"],
  },
  pae: {
    th: "แพะเคราแหลม ปีนป่ายเก่ง เล็มหญ้ากินทั้งวัน เลี้ยงกันมากทางภาคใต้",
    en: "A goat with a pointed beard, nimble and always grazing — a common sight across the south.",
    tips: ["ชอบเล็มหญ้า · Grazes often", "อยู่ฝูงกับแกะ · Herds with sheep"],
  },
  kae: {
    th: "แกะขนฟูนุ่ม ขี้อายและตกใจง่าย อยู่รวมเป็นฝูงไม่ยอมห่างกัน",
    en: "A woolly sheep, shy and easily frightened, sticking close to its flock.",
    tips: ["ขี้ตกใจมาก · Very timid", "อยู่ฝูงกับแพะ · Herds with goats"],
  },
  "luk-kwai": {
    th: "ลูกควายตัวน้อย ขาเก้งก้าง วิ่งตามแม่ไม่ห่าง ซุกซนและขี้ตกใจกว่าควายโต",
    en: "A leggy buffalo calf that never strays far from mum — playful, and more timid than the grown-ups.",
    tips: ["เดินตามควายหรือวัวขาว · Follows a buffalo or white ox", "ว่ายน้ำได้ · Swims"],
  },
  jorakhe: {
    th: "จระเข้นอนนิ่งรอเหยื่ออยู่ริมน้ำ ดูเหมือนหลับแต่พร้อมงับทุกเมื่อ ในนิทานไกรทองมีชาละวันพญาจระเข้แห่งเมืองพิจิตร",
    en: "A crocodile lying motionless at the water's edge, seemingly asleep but ready to snap — kin of Chalawan, the crocodile king of the Krai Thong legend.",
    tips: ["นักซุ่ม: นิ่งแล้วงับสัตว์ที่เดินผ่าน · Lurker: lies still, then snaps at passing animals", "น้ำท่วมแล้วว่ายเร็วและล่าไกลขึ้น · Faster and hungrier in a flood", "กินอิ่มแล้วจะพักสักพัก · Rests after a meal"],
  },
  suea: {
    th: "เสือโคร่งเจ้าป่า ลายพาดกลอน ย่องเงียบแล้วตะปบเหยื่อ สัตว์ทุกตัวต่างหวาดกลัว",
    en: "The tiger, lord of the jungle in bold stripes, stalking silently before it pounces — every creature fears it.",
    tips: ["นักล่า: ย่องตามแล้วตะปบ · Stalker: creeps up, then pounces", "ออกหากินกลางคืน · Nocturnal", "สัตว์ที่ตัวเล็กกว่าจะหนี · Smaller animals flee"],
  },
  "kwang-thong": {
    th: "กวางทอง ในรามเกียรติ์คือมารีศแปลงกายมาล่อนางสีดาจนพระรามต้องตามไป ทำให้ทศกัณฐ์ลักพาตัวนางได้ เป็นสัตว์ขี้อายที่วิ่งเร็วที่สุดตัวหนึ่ง",
    en: "The golden deer — in the Ramakien it is the demon Marit in disguise, luring Sita so Rama gives chase and Thotsakan can carry her off. Shy, and one of the fastest runners here.",
    tips: ["ขี้ตกใจที่สุด · Extremely timid", "วิ่งเร็วมาก · Very fast"],
  },
  "chang-noi": {
    th: "ลูกช้างน้อยงวงสั้น ซุกซน เดินตามแม่ช้างไม่ยอมห่าง และชอบเล่นน้ำ",
    en: "A baby elephant with a stubby trunk, playful and glued to its mother's side, and fond of splashing.",
    tips: ["เดินตามช้างหรือช้างทรง · Follows an elephant or royal elephant", "ว่ายน้ำได้ · Swims"],
  },
  "nok-yung": {
    th: "นกยูงไทยสีเขียวเหลือบทอง หางรำแพนงดงาม เป็นนกที่สง่าแต่ขี้อาย",
    en: "The green peafowl, shimmering green and gold with a magnificent fanned train — regal but shy.",
    tips: ["เดินกระโดด · Hops along", "ขี้ตกใจ · Timid"],
  },
  "kai-jae": {
    th: "ไก่แจ้ตัวเล็กขนสวย เดินกระดุ๊กกระดิ๊ก เลี้ยงไว้ดูเล่นในบ้าน",
    en: "A pretty little bantam that bobs and hops about, kept for the joy of it.",
    tips: ["ลูกเจี๊ยบเดินตามได้ · Chicks follow her", "กลัวหมา · Afraid of dogs"],
  },
  han: {
    th: "ห่านคอยาว เสียงดัง ขี้หวงถิ่นจนชาวบ้านเลี้ยงไว้เฝ้าบ้านแทนหมา",
    en: "A long-necked goose, loud and territorial enough that villagers keep them as watch-birds.",
    tips: ["ว่ายน้ำได้ · Swims", "ใจกล้ากว่าเป็ด · Bolder than ducks"],
  },
  "nok-ngueak": {
    th: "นกเงือกปากใหญ่มีโหนกบนหัว ผู้ปลูกป่าตัวจริงเพราะกินผลไม้แล้วกระจายเมล็ด ขึ้นชื่อว่าซื่อสัตย์ต่อคู่ตลอดชีวิต",
    en: "The great hornbill with its casqued bill, a true forest-planter that spreads seeds — famous for staying faithful to one mate for life.",
    tips: ["บินขึ้นได้บางครั้ง · Sometimes takes flight", "บินหนีเมื่อตกใจหรือน้ำท่วม · Flies off when scared or flooded"],
  },
  kratai: {
    th: "กระต่ายหูยาว กระโดดดึ๋ง ๆ ขี้ตกใจที่สุด คนไทยเชื่อว่ามีกระต่ายอยู่บนดวงจันทร์",
    en: "A long-eared rabbit that bounds along, terribly timid; Thais say a rabbit lives on the moon.",
    tips: ["กระโดดวิ่ง · Bounds", "ขี้ตกใจมาก กลัวหมา · Very timid, and afraid of dogs"],
  },
  tao: {
    th: "เต่าน้อยคลานช้า ๆ อายุยืน ในวัดมักมีบ่อเต่าให้คนปล่อยทำบุญ",
    en: "A slow, long-lived turtle; many temples keep a turtle pond where people release them for merit.",
    tips: ["ช้าที่สุดในโรง · The slowest creature on stage", "ว่ายน้ำได้ · Swims"],
  },
  pu: {
    th: "ปูทะเลก้ามโต เดินข้างตามแบบฉบับของปู อาศัยในป่าชายเลน",
    en: "A mud crab with big claws, scuttling sideways as crabs do, at home in the mangroves.",
    tips: ["เดินออกข้าง · Walks sideways", "ว่ายน้ำได้ · Swims"],
  },
  kop: {
    th: "กบนาตัวเล็ก กระโดดไกล ร้องอ๊บ ๆ ระงมเมื่อฝนตก ออกหากินกลางคืน",
    en: "A little paddy frog that leaps far and croaks in chorus when it rains, out and about at night.",
    tips: ["กระโดดวิ่ง · Bounds", "ออกหากินกลางคืน · Nocturnal", "แมวเป็นศัตรู · Fears cats"],
  },
  erawan: {
    th: "ช้างเอราวัณสามเศียรเผือกผ่อง พาหนะของพระอินทร์ในสวรรค์ชั้นดาวดึงส์ ตามตำนานมีถึงสามสิบสามเศียร เป็นสัญลักษณ์แห่งความยิ่งใหญ่",
    en: "Erawan, Indra's white three-headed elephant mount from the Tavatimsa heaven — in legend it has thirty-three heads — a symbol of divine majesty.",
    tips: ["ใหญ่และนิ่งที่สุด แทบไม่กลัวอะไร · Huge and almost fearless", "อยู่ฝูงกับช้าง · Herds with elephants", "ว่ายน้ำได้ · Swims"],
  },

  // ================================================================ monsters
  "phaya-nak": {
    th: "พญานาคห้าเศียร เจ้าแห่งบาดาลและแม่น้ำโขง ผู้นำฝนมาให้ และเป็นผู้แผ่พังพานปกป้องพระพุทธเจ้า ใครเห็นต้องเกรงขาม",
    en: "The five-headed naga king of the underworld and the Mekong, bringer of rain, who spread his hoods to shelter the Buddha. All who see him are awed.",
    tips: ["ปีศาจ: สัตว์ทุกตัวหนี · Monster: every animal flees", "ว่ายในน้ำท่วมได้ · Swims in a flood", "หมาไทยจะเห่า · Dogs bark at it"],
  },
  mangkon: {
    th: "มังกรจีนลำตัวยาวคดเคี้ยว บินอยู่บนฟ้าตลอดเวลา สัญลักษณ์ของพลังและโชคลาภ พบในวัดจีนและงานตรุษจีนทั่วไทย",
    en: "A long, sinuous Chinese dragon that never leaves the sky — a symbol of power and luck, seen in Chinese shrines and New Year parades across Thailand.",
    tips: ["บินตลอดเวลา · Always flying", "ปีศาจ: สัตว์ใต้เงาจะหนี · Monster: animals beneath it flee"],
  },
  krasue: {
    th: "ผีกระสือ หัวหญิงสาวสวยลอยได้ มีไส้และอวัยวะเรืองแสงห้อยระย้า ออกหากินกลางคืน เป็นผีที่คนไทยเล่าต่อกันมาแต่โบราณ",
    en: "The krasue: a beautiful woman's head that floats free, glowing entrails dangling beneath it — a night-hunting ghost from age-old Thai folklore.",
    tips: ["ลอยกลางอากาศและเรืองแสง · Floats and glows", "กลางคืนจะส่งเสียงโหยหวน · Wails at night", "ออกหากินกลางคืน · Nocturnal"],
  },
  khrut: {
    th: "ครุฑ พญาปักษาครึ่งคนครึ่งนก พาหนะของพระนารายณ์ และเป็นตราแผ่นดินของไทย เป็นศัตรูคู่อาฆาตกับนาค",
    en: "Garuda, king of birds, half man and half eagle, mount of Vishnu and emblem of the Thai state — and sworn enemy of the nagas.",
    tips: ["บินตลอดเวลาและเร็วที่สุด · Always flying, and the fastest", "ปีศาจ: สัตว์ตกใจหนี · Monster: animals flee"],
  },
  pret: {
    th: "เปรต ผีตัวสูงเท่าต้นตาล ปากเล็กเท่ารูเข็ม หิวโหยตลอดกาลเพราะผลกรรม ญาติจึงทำบุญอุทิศให้ในวันสารทเดือนสิบ",
    en: "A pret, the hungry ghost tall as a sugar palm with a mouth as small as a needle's eye, forever starving for its sins — fed with merit at the southern Sart Duean Sip festival.",
    tips: ["เดินช้ามาก · Very slow", "ออกหากินกลางคืน · Nocturnal"],
  },
  "phi-ta-khon": {
    th: "ผีตาโขนแห่งอำเภอด่านซ้าย จังหวัดเลย หน้ากากทำจากหวดนึ่งข้าวกับโคนก้านมะพร้าว จมูกยาว สีสด ออกแห่ในงานบุญหลวงอย่างสนุกสนาน",
    en: "Phi Ta Khon of Dan Sai, Loei — masks made from sticky-rice steamers and coconut-palm stems, long-nosed and brightly painted, dancing through the Bun Luang festival.",
    tips: ["กระโดดไปมา · Hops about", "ปีศาจ: สัตว์ตกใจหนี · Monster: animals flee"],
  },

  // ================================================================ buildings
  "thai-house": {
    th: "เรือนไทยใต้ถุนสูง หลังคาจั่วทรงสูงประดับป้านลม ใต้ถุนโล่งรับลมและหนีน้ำหลาก เป็นบ้านที่เหมาะกับฝนและแดดเมืองไทย",
    en: "A Thai house on tall stilts with a steep gabled roof — the open space beneath catches the breeze and escapes the floods, made for Thailand's sun and rain.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding", "ตั้งอยู่กับที่ · Stands fixed"],
  },
  "thatched-hut": {
    th: "กระท่อมหลังคามุงจาก ฝาไม้ไผ่ขัดแตะ ที่พักกลางทุ่งนาของชาวนา",
    en: "A hut with a palm-thatch roof and woven bamboo walls, the farmer's shelter out in the fields.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  sala: {
    th: "ศาลาไทยเปิดโล่ง ให้คนเดินทางแวะพัก หลบแดดหลบฝน หรือนั่งคุยกันริมทาง",
    en: "An open Thai pavilion where travellers rest, shelter from sun and rain, or sit and chat by the road.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  "spirit-house": {
    th: "ศาลพระภูมิบนเสาสูง ที่สถิตของเจ้าที่ผู้ปกปักรักษาบ้าน ชาวบ้านถวายพวงมาลัย น้ำแดง และม้าลายทุกวัน",
    en: "A spirit house on a post, home of the guardian spirit of the land, offered garlands, red soda and little zebras every day.",
    tips: ["วางพวงมาลัยไว้ข้าง ๆ · Set a garland beside it"],
  },
  ubosot: {
    th: "โบสถ์ อาคารศักดิ์สิทธิ์ที่สุดในวัด ใช้บวชพระและทำสังฆกรรม หลังคาซ้อนชั้นประดับช่อฟ้าใบระกา",
    en: "The ubosot, the most sacred hall of a temple where monks are ordained, its tiered roofs crowned with chofa finials.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  chedi: {
    th: "เจดีย์ทรงระฆังยอดแหลม บรรจุพระบรมสารีริกธาตุหรือพระธาตุ ชาวพุทธเวียนเทียนรอบในวันพระใหญ่",
    en: "A bell-shaped stupa with a tapering spire, enshrining relics; Buddhists walk candlelit circles around it on holy days.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  prang: {
    th: "พระปรางค์ทรงฝักข้าวโพดแบบเขมร อย่างวัดอรุณฯ ริมเจ้าพระยา สัญลักษณ์ของเขาพระสุเมรุศูนย์กลางจักรวาล",
    en: "A corn-cob prang tower of Khmer descent, like Wat Arun on the Chao Phraya — a symbol of Mount Meru at the centre of the universe.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  palace: {
    th: "ปราสาทราชวังยอดปราสาทซ้อนชั้น ที่ประทับของพญาและเจ้าหญิง ฉากหลังของทุกเรื่องจักร ๆ วงศ์ ๆ",
    en: "A royal palace with tiered spires, home of kings and princesses and backdrop to every royal tale.",
    tips: ["ใหญ่ที่สุดในหีบ · The largest piece in the chest", "สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  "village-well": {
    th: "บ่อน้ำประจำหมู่บ้าน มีรอกและถังตักน้ำ เป็นที่พบปะพูดคุยของชาวบ้านยามเช้าเย็น",
    en: "The village well with pulley and bucket, where neighbours meet and gossip morning and evening.",
  },
  "wooden-bridge": {
    th: "สะพานไม้ข้ามคลอง เดินได้ทีละคน เสียงไม้ลั่นเอี๊ยดอ๊าดใต้เท้า",
    en: "A wooden footbridge over a canal, one person at a time, boards creaking underfoot.",
  },
  "bamboo-fence": {
    th: "รั้วไม้ไผ่ขัดเป็นตาราง กั้นสวนครัวไม่ให้ไก่เข้าไปคุ้ย",
    en: "A lattice bamboo fence to keep the chickens out of the kitchen garden.",
  },
  "khok-mu": {
    th: "คอกหมูไม้ไผ่ข้างบ้าน ชาวบ้านเลี้ยงหมูไว้กินเศษอาหาร",
    en: "A bamboo pig pen beside the house, where scraps feed the family pig.",
    tips: ["ลองวางหมูไว้ข้างใน · Pop a pig inside"],
  },
  "lao-kai": {
    th: "เล้าไก่ยกพื้นสูงหนีหมาและงู ตอนค่ำไก่จะขึ้นไปนอนในเล้า",
    en: "A chicken coop on stilts, safe from dogs and snakes, where hens roost at dusk.",
  },
  "yung-khao": {
    th: "ยุ้งข้าวเก็บข้าวเปลือกหลังเก็บเกี่ยว ยกพื้นสูงกันหนูและความชื้น เป็นทรัพย์สมบัติของชาวนา",
    en: "A raised rice barn that stores the harvest safe from rats and damp — a farming family's treasure.",
    tips: ["สร้างขึ้นจากนั่งร้านไม้ไผ่ · Rises out of bamboo scaffolding"],
  },
  "thong-takhab": {
    th: "ธงตะขาบผ้ายาวมีขาเหมือนตะขาบ ปักไว้ในงานบุญกฐินเพื่อบอกว่าวัดนี้ได้รับกฐินแล้ว",
    en: "A long centipede flag with leg-like tabs, raised at a temple to announce its Kathin robe offering has been received.",
  },

  // ================================================================ nature
  "fang-khao": {
    th: "ลอมฟางข้าวกองสูงหลังฤดูเกี่ยว เก็บไว้เป็นอาหารวัวควายตลอดหน้าแล้ง",
    en: "A tall rice-straw stack after harvest, fodder for the cattle through the dry season.",
  },
  "ton-khao": {
    th: "กอต้นข้าวเขียวขจีในนา รวงข้าวโน้มเมื่อแก่ ข้าวคือชีวิตของคนไทย",
    en: "A green clump of rice in the paddy, its heads bowing as they ripen — rice is life in Thailand.",
  },
  "hun-lai-ka": {
    th: "หุ่นไล่กาสวมงอบใส่เสื้อเก่า ยืนกางแขนกลางนาคอยไล่นกมากินข้าว",
    en: "A scarecrow in a ngop hat and old shirt, arms outstretched in the paddy to shoo the birds from the rice.",
  },
  "kanghan-nam": {
    th: "กังหันน้ำไม้ไผ่ วิดน้ำจากลำห้วยขึ้นสู่ไร่นา ภูมิปัญญาชาวบ้านที่ใช้แรงน้ำล้วน ๆ",
    en: "A bamboo water wheel lifting water from the stream into the fields, village ingenuity powered by the current alone.",
  },
  "coconut-palm": {
    th: "ต้นมะพร้าวลำต้นสูงโค้ง ทางใบแผ่กว้าง ผลเป็นทะลาย พบได้ทุกริมคลองและชายหาด",
    en: "A tall, curving coconut palm with spreading fronds and clustered nuts, along every canal and beach.",
    tips: ["ฉากหลังตั้งนิ่ง ไม่โยกตามลม · Static backdrop; doesn't sway"],
  },
  "banana-plant": {
    th: "ต้นกล้วยใบกว้างมีเครือกล้วยห้อย ทุกส่วนใช้ประโยชน์ได้ ทั้งผล ใบตอง และหยวก",
    en: "A banana plant with broad leaves and a hanging bunch — fruit, leaf and trunk all have their uses.",
    tips: ["ฉากหลังตั้งนิ่ง · Static backdrop"],
  },
  "bodhi-tree": {
    th: "ต้นโพธิ์ใบรูปหัวใจ ใต้ต้นไม้นี้พระพุทธเจ้าตรัสรู้ จึงปลูกไว้ในวัดแทบทุกแห่ง",
    en: "The bodhi tree with heart-shaped leaves, under which the Buddha found enlightenment — planted in nearly every temple.",
    tips: ["ฉากหลังตั้งนิ่ง · Static backdrop"],
  },
  "bamboo-clump": {
    th: "กอไผ่ลำสูงชะลูด ใช้สร้างบ้าน ทำเครื่องจักสาน และหน่อไม้ก็เป็นอาหาร",
    en: "A clump of tall bamboo — for building, for weaving, and its shoots for the table.",
    tips: ["ฉากหลังตั้งนิ่ง · Static backdrop"],
  },
  "lotus-pond": {
    th: "กอบัวกลางสระ ดอกตูมดอกบาน ใบลอยน้ำ ดอกบัวคือสัญลักษณ์แห่งความบริสุทธิ์ในพุทธศาสนา",
    en: "A lotus cluster in a pond, buds and blooms among floating leaves — the Buddhist symbol of purity rising from the mud.",
  },
  "mural-mountain": {
    th: "ภูเขาเขามอแบบจิตรกรรมฝาผนังไทย หินผาซ้อนเป็นก้อนเหลี่ยม ใช้แทนป่าเขาหิมพานต์ในภาพวาดวัด",
    en: "A stylised mural mountain of stacked angular rocks (khao mo / sinthao), the way temple paintings show the Himmaphan wilds.",
    tips: ["ฉากหลังตั้งนิ่ง · Static backdrop"],
  },
  rock: {
    th: "ก้อนหินกลางป่า หนักพอจะให้ตัวหนังนั่งพักหรือปีนขึ้นไปยืน",
    en: "A forest boulder, heavy enough for a puppet to sit on or climb.",
    tips: ["ลากเล่นได้ แต่หนัก · Movable, but heavy"],
  },
  moon: {
    th: "พระจันทร์เต็มดวงที่มีเงากระต่ายอยู่ข้างใน ตามความเชื่อไทย กระต่ายบนดวงจันทร์ตำข้าวรอใครสักคน",
    en: "A full moon with the shadow of a rabbit inside — Thai folk say the moon rabbit is pounding rice up there.",
    tips: ["ส่องแสงนวล · Gives off a soft glow", "ใช้คู่กับแสงราตรี · Pair it with Moonlight"],
  },
  sun: {
    th: "พระอาทิตย์ส่องรัศมีเป็นแฉก ให้แสงอบอุ่นสว่างไปทั้งฉาก",
    en: "A sun with flaring rays, flooding the scene with warm light.",
    tips: ["ส่องแสงสว่าง · Casts a big warm glow"],
  },
  "scroll-cloud": {
    th: "เมฆลายไทยม้วนเป็นกนก แบบที่ช่างเขียนใช้ในภาพสวรรค์และเทวดาเหาะ",
    en: "A Thai scroll cloud curling into kanok flourishes, as painters draw the heavens and flying devas.",
    tips: ["ลอยนิ่งกลางฟ้า · Hangs still in the sky"],
  },
  campfire: {
    th: "กองไฟวาดลายสำหรับตั้งแคมป์กลางป่า ให้แสงอุ่นเรืองแต่ไม่ร้อน",
    en: "A painted campfire for a night in the woods — a warm glow, but no real heat.",
    tips: ["แค่แสง ไม่เผาตัวหนัง (ถ้าอยากได้ไฟจริงใช้กองไฟลุก) · Light only — use the Bonfire for real flames"],
  },
  "forest-tree": {
    th: "ต้นไม้ป่าทรงพุ่มใหญ่แบบฉากหนังตะลุง ใช้เป็นกรอบฉากป่าซ้ายขวา",
    en: "A great leafy forest tree in shadow-play style, for framing a jungle scene left and right.",
    tips: ["ฉากหลังตั้งนิ่ง · Static backdrop"],
  },

  // ================================================================ foliage
  "ton-maphrao": {
    th: "ต้นมะพร้าวที่ทางใบลู่ลมได้จริง ยิ่งลมแรงยิ่งโยกไหว ให้ฉากริมคลองมีชีวิต",
    en: "A coconut palm whose fronds really move — the stronger the wind, the more it sways, bringing a canal scene to life.",
    tips: ["โยกตามลม แรงขึ้นตอนพายุ · Sways in wind, thrashes in a storm", "ไม่ชนกับตัวหนัง · Puppets pass through it"],
  },
  "ton-tan": {
    th: "ต้นตาลโตนดสูงลิ่วพร้อมพะองไม้ไผ่ให้คนขึ้นปาดงวงเอาน้ำตาลสด ภาพเอกลักษณ์ของสงขลาและเพชรบุรี",
    en: "A towering sugar palm with the tapper's bamboo ladder lashed to it, for collecting sweet sap — the signature of Songkhla and Phetchaburi.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-mak": {
    th: "ต้นหมากลำเรียวมีเถาพลูพันขึ้นไป หมากกับพลูคือของคู่กันในการกินหมากของคนไทยโบราณ",
    en: "A slender areca palm with a betel vine climbing it — the two together made the betel quid of old Thailand.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-kluai": {
    th: "กอกล้วยใบใหญ่ที่สั่นไหวตามลม ใบแตกเป็นริ้วเมื่อโดนลมแรง",
    en: "A banana clump whose big leaves flutter and shiver in the wind.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-pho": {
    th: "ต้นโพธิ์ใหญ่กิ่งก้านแผ่ ใบไหวระริกแม้ลมแผ่ว ร่มเงาให้ตัวหนังนั่งพัก",
    en: "A great spreading bodhi tree whose leaves tremble even in a breath of air, shading puppets beneath.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-sai": {
    th: "ต้นไทรมีรากอากาศห้อยระย้า คนไทยเชื่อว่ามีนางไม้สิงสถิต จึงมักผูกผ้าสามสีไว้ที่โคน",
    en: "A banyan with dangling aerial roots; Thais believe a tree spirit lives within and tie three-coloured cloth around its trunk.",
    tips: ["รากห้อยแกว่งตามลม · Hanging roots swing in the wind"],
  },
  "ton-mamuang": {
    th: "ต้นมะม่วงออกผลดก ลูกห้อยเต็มต้น ร่มเงาของลานบ้านในหน้าร้อน",
    en: "A mango tree heavy with fruit, the shady heart of a yard in the hot season.",
    tips: ["ผลแกว่งตามลม · Fruit swings in the wind"],
  },
  "ton-leelawadee": {
    th: "ต้นลีลาวดีดอกขาวเหลืองหอมกรุ่น กิ่งคดงาม ปลูกในวัดและสวน",
    en: "A frangipani with fragrant white-and-yellow blossoms on gnarled branches, in temples and gardens.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-ratchaphruek": {
    th: "ต้นราชพฤกษ์ดอกสีเหลืองทองห้อยเป็นช่อระย้า ต้นไม้ประจำชาติไทย บานสะพรั่งในหน้าร้อน",
    en: "The golden shower tree, national tree of Thailand, its golden chains of flowers blazing in the hot season.",
    tips: ["ช่อดอกแกว่งตามลม · Flower chains swing in the wind"],
  },
  "ton-hukwang": {
    th: "ต้นหูกวางกิ่งแผ่เป็นชั้น ๆ เหมือนฉัตร ร่มเงาดีจนนิยมปลูกในโรงเรียนและลานกีฬา",
    en: "An Indian almond with branches in tiers like a parasol, so shady it's planted at schools and sports grounds.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ton-yangna": {
    th: "ต้นยางนายักษ์ใหญ่แห่งป่าดิบ ลำต้นตรงสูงลิ่ว น้ำมันยางใช้ทาเรือและจุดไต้",
    en: "A yang-na giant of the evergreen forest, ramrod straight and towering; its resin once caulked boats and fuelled torches.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "kor-phai": {
    th: "กอไผ่ที่ลำโน้มเอนตามลม เสียงใบไผ่เสียดสีกันเป็นเสียงของชนบท",
    en: "A bamboo clump whose canes bow with the wind, the rustle of its leaves the sound of the countryside.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "kor-bua": {
    th: "กอบัวก้านยาวที่ดอกและใบโยกไหวเบา ๆ เหนือผิวน้ำ",
    en: "A lotus clump whose long-stemmed flowers and leaves nod gently above the water.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "ya-kha": {
    th: "หญ้าคาใบเรียวยาว ชาวบ้านเกี่ยวมาเย็บเป็นตับมุงหลังคากระท่อม",
    en: "Tall slender cogon grass, cut and stitched into panels to thatch village huts.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "dong-ya": {
    th: "ดงหญ้าเตี้ย ๆ ใช้ปูหน้าฉากให้พื้นดินดูมีชีวิต",
    en: "Low grass tufts to dress the front of a scene so the ground looks alive.",
    tips: ["ตั้งอยู่กับที่ · Stands fixed"],
  },
  "phum-chaba": {
    th: "พุ่มชบาดอกแดงสด ปลูกเป็นรั้วบ้าน ดอกบานทั้งปี",
    en: "A hibiscus bush with bright red flowers, grown as a hedge and in bloom all year.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  fern: {
    th: "เฟิร์นใบฝอยขึ้นตามโคนไม้ในป่าชื้น ให้ฉากป่าดูร่มรื่น",
    en: "A feathery fern from the damp forest floor, making a jungle scene feel lush.",
    tips: ["โยกตามลม · Sways in the wind"],
  },
  "thao-wan": {
    th: "เถาวัลย์ห้อยจากขอบบนของจอ แกว่งไกวตามลม เหมือนป่าดงดิบที่ลิงโหนเล่น",
    en: "Vines hanging from the top of the cloth and swinging in the wind, like a jungle made for monkeys.",
    tips: ["ห้อยจากด้านบนของจอ · Hangs from the top of the cloth", "แกว่งเป็นลูกตุ้มตามลม · Swings like a pendulum in wind"],
  },
  "ton-himmaphan": {
    th: "ต้นไม้วิเศษแห่งป่าหิมพานต์ ใบเป็นอัญมณีส่องประกาย ดอกเป็นทองคำ ในตำนานบางต้นออกผลเป็นนางนารีผล",
    en: "A jewel tree of the mythical Himmaphan forest with gem leaves and golden flowers — in legend, some such trees bear the maiden-fruit nariphon.",
    tips: ["โยกตามลม · Sways in the wind"],
  },

  // ================================================================ boats
  "rowing-boat": {
    th: "เรือพายลำเล็ก แม่ค้าตลาดน้ำพายขายของพร้อมงอบใบลาน",
    en: "A small rowing boat, the floating-market vendor's shop under a palm-leaf hat.",
    tips: ["ลอยน้ำ: ขึ้นตามระดับน้ำท่วม · Floats, rising with a flood"],
  },
  "longtail-boat": {
    th: "เรือหางยาวติดเครื่องยนต์ท้ายเรือด้ามยาว แล่นเร็วตามคลองและทะเลอันดามัน หัวเรือผูกผ้าสีบูชาแม่ย่านาง",
    en: "A long-tail boat with its engine on a long shaft, racing along canals and the Andaman coast, the bow tied with coloured cloth for the boat goddess Mae Ya Nang.",
    tips: ["ลอยน้ำ: ขึ้นตามระดับน้ำท่วม · Floats, rising with a flood"],
  },
  "swan-barge": {
    th: "เรือพระที่นั่งสุพรรณหงส์ หัวเรือเป็นหงส์ทองสง่างาม ใช้ในขบวนพยุหยาตราทางชลมารคบนแม่น้ำเจ้าพระยา",
    en: "The Suphannahong royal barge with its golden swan prow, leading the Royal Barge Procession on the Chao Phraya.",
    tips: ["ลอยน้ำ: ขึ้นตามระดับน้ำท่วม · Floats, rising with a flood", "ลำใหญ่ที่สุดในลิ้นชักเรือ · The biggest boat in the drawer"],
  },
  "bamboo-raft": {
    th: "แพไม้ไผ่ผูกเรียงกัน ล่องลำน้ำช้า ๆ อย่างแพที่ล่องแม่น้ำแควและปาย",
    en: "A raft of lashed bamboo poles, drifting slowly downstream as on the Kwai and Pai rivers.",
    tips: ["ลอยน้ำ: ขึ้นตามระดับน้ำท่วม · Floats, rising with a flood"],
  },
  "wave-band": {
    th: "แถบคลื่นน้ำแบบจิตรกรรมฝาผนัง ลายเกล็ดคลื่นซ้อนกันเป็นแถว ใช้วางหน้าเรือให้เหมือนลอยอยู่บนน้ำ",
    en: "A band of mural-style scalloped waves to lay in front of boats so they seem to sail on water.",
    tips: ["ตั้งอยู่กับที่ · Stands fixed", "วางไว้หน้าเรือ · Place it in front of a boat"],
  },

  // ================================================================ games
  takraw: {
    th: "ลูกตะกร้อสานจากเส้นหวายเป็นตาโปร่งสิบสองรู เบาและเด้ง เตะได้ด้วยเท้า เข่า และศีรษะ ห้ามใช้มือ เป็นกีฬาพื้นบ้านของอุษาคเนย์",
    en: "A takraw ball woven from rattan strips into a light, springy openwork sphere with twelve holes. Kick it with foot, knee or head — never hands — Southeast Asia's own folk sport.",
    tips: ["ให้เทวดาบทเตะตะกร้อสองคนขึ้นไป แล้วจะส่งลูกกันเป็นวง · Give two or more puppets the Takraw role and they pass it around", "ลูกตกพื้นคือจบรอบ · A rally ends when it touches the ground", "ถ้าไม่มีลูก เทวดาจะหยิบมาเอง · No ball? The deva brings one"],
  },
  "pingpong-table": {
    th: "โต๊ะปิงปองมีตาข่ายกลาง ปิงปองเป็นกีฬายอดนิยมตามลานวัดและโรงเรียนในหมู่บ้าน",
    en: "A ping-pong table with a net — table tennis is a favourite in temple yards and village schools.",
    tips: ["ตัวหนังบทปิงปองสองตัวจะตีโต้กันข้ามโต๊ะ · Two Ping-pong-role puppets rally across it", "คนที่สามจะยืนเชียร์ข้างโต๊ะ · A third player stands by and cheers", "ถ้าไม่มีโต๊ะ เทวดาจะตั้งให้ · No table? The deva sets one up"],
  },
  "pingpong-paddle": {
    th: "ไม้ปิงปองหน้ายางสีแดง จับถนัดมือ ใช้ตีโต้ลูกเร็ว",
    en: "A ping-pong paddle with red rubber, for quick returns.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it", "ฟาดได้แบบอาวุธทื่อเบา ๆ · Swats as a light blunt weapon"],
  },
  "pingpong-paddle-blue": {
    th: "ไม้ปิงปองหน้ายางสีคราม คู่กับไม้สีแดงสำหรับฝ่ายตรงข้าม",
    en: "A ping-pong paddle in indigo rubber, the opponent's partner to the red one.",
    tips: ["วางที่มือเพื่อถือ · Drop it on a hand to hold it"],
  },
  "pingpong-ball": {
    th: "ลูกปิงปองสีขาวเบาหวิว เด้งดีบนโต๊ะ ตีแรงก็หมุนเลี้ยวได้",
    en: "A feather-light white ball that bounces crisply and curves when hit with spin.",
    tips: ["ตกพื้นหรือไม่มีใครตีนานเกินไปถือว่าลูกตาย · Dead ball if it hits the floor or nobody returns it", "ตีโต้ได้ทุกสิบครั้งจะมีเสียงเชียร์ · Every ten returns gets a cheer"],
  },
  "jump-rope": {
    th: "เชือกกระโดดด้ามไม้ เกมของเด็ก ๆ ตอนพักเที่ยง นับเสียงดังพร้อมกันทุกครั้งที่กระโดดข้าม",
    en: "A jump rope with wooden handles, the lunchtime game where everyone counts aloud with each jump.",
    tips: ["ส่งให้ตัวหนังแล้วให้เทวดาบทกระโดดเชือก · Hand it to a puppet and give it the Rope-jumper role", "ครบทุกสิบครั้งจะนับเป็นเลขไทย · Every ten jumps it calls the count in Thai numerals", "หมุนเร็วขึ้นเรื่อย ๆ จนสะดุด · Spins faster and faster until someone trips"],
  },

  // ================================================================ vehicles
  "ox-cart": {
    th: "เกวียนไม้ล้อซี่ใหญ่ เคยเป็นพาหนะขนข้าวและสินค้าข้ามทุ่งของคนไทยก่อนมีถนน",
    en: "A wooden ox cart on big spoked wheels, how rice and goods crossed the plains before roads.",
    tips: ["ล้อหมุนกลิ้งได้จริง · Its wheels really roll", "ลากไปมาได้ · Drag it along"],
  },
  samlor: {
    th: "สามล้อถีบ รถรับจ้างสามล้อที่คนถีบปั่น เคยวิ่งทั่วตลาดในต่างจังหวัด",
    en: "A pedal samlor, the three-wheeled pedicab once found at every provincial market.",
    tips: ["ล้อหมุนกลิ้งได้จริง · Its wheels really roll"],
  },
  "tuk-tuk": {
    th: "ตุ๊กตุ๊ก รถสามล้อเครื่องเสียงดังตุ๊ก ๆ สัญลักษณ์ของถนนกรุงเทพฯ ที่นักท่องเที่ยวทั่วโลกรู้จัก",
    en: "The tuk-tuk, the noisy motor-rickshaw named for its engine's putter, an icon of Bangkok's streets.",
    tips: ["ล้อหมุนกลิ้งได้จริง · Its wheels really roll"],
  },
  bicycle: {
    th: "จักรยานคันเก่า พาหนะของครูและเด็กนักเรียนต่างจังหวัด ปั่นไปตามคันนา",
    en: "An old bicycle, the ride of country teachers and schoolchildren along the paddy dykes.",
    tips: ["ล้อหมุนกลิ้งได้จริง · Its wheels really roll"],
  },

  // ================================================================ scenes
  "scene-himmaphan": {
    th: "ป่าหิมพานต์ใต้แสงจันทร์ ดินแดนในตำนานที่มีสัตว์วิเศษ ต้นไม้อัญมณี กวางทอง นกยูง ครุฑ ฤๅษีบำเพ็ญพรต และเทวดาร่ายรำ",
    en: "The mythical Himmaphan forest by moonlight — magical beasts, jewel trees, a golden deer, a peacock and a garuda, with the hermit at prayer and a deva dancing.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up", "แสงราตรี: สัตว์ส่วนใหญ่หลับ · Moonlight: most animals sleep"],
  },
  "scene-floating-market": {
    th: "ตลาดน้ำยามรุ่งอรุณ เรือพายเรือหางยาวบรรทุกผลไม้ แม่ค้าร้องขาย ชาวบ้านต่อราคา เด็กวิ่งเล่น และเป็ดห่านว่ายผ่าน",
    en: "A floating market at dawn: rowing and long-tail boats laden with fruit, vendors calling out, villagers haggling, a child running about, ducks and geese paddling by.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up"],
  },
  "scene-temple-fair": {
    th: "งานวัดยามค่ำ โบสถ์ เจดีย์ โคมลอย คบเพลิง วงปี่พาทย์ นางเอกกับพระเอกรำคู่ ไอ้เท่งกับหนูนุ้ยเล่นตลก และแม่ค้าขายของ",
    en: "A temple fair at dusk with the ordination hall, a stupa, sky lanterns, torches and a piphat band — the prince and princess dance while Ai Teng and Nu Nui clown around.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up", "ระวังกองไฟจริงในฉาก · Mind the real bonfire"],
  },
  "scene-lanka": {
    th: "ศึกกรุงลงกากลางพายุฟ้าคะนอง พระเอกถือดาบและหนุมานบุกเมือง ยักษ์ถือง้าวและพญาถือดาบสองมือออกรับ ทุกตัวมีวิญญาณ เลือดตกยางออกจริง",
    en: "The Battle of Lanka in a thunderstorm: the prince with his sword and Hanuman storm the city as the demon with his glaive and the king with a long sword meet them. Everyone has a soul, so wounds are real.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up", "พระเอกมียันต์คุ้มกัน · The prince is warded", "ใช้คาถาชุบชีวิตเมื่อมีคนล้ม · Use Mend & revive on the fallen"],
  },
  "scene-rice-fields": {
    th: "ทุ่งนาบ้านเรา กระท่อม ยุ้งข้าว ต้นตาล หุ่นไล่กา ควายกับลูก แม่ไก่กับลูกเจี๊ยบ หมาไทย และหมูเด้งกับแม่ฮิปโปมาเที่ยวทุ่ง ผู้ใหญ่พูนเดินทักชาวบ้าน",
    en: "Home in the rice fields: a hut, a granary, sugar palms and a scarecrow; a buffalo and calf, hen and chicks, a Thai dog, and Moo Deng with her mother out for a visit while the headman greets everyone.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up"],
  },
  "scene-moo-deng-pond": {
    th: "บึงหมูเด้งยามฝนตกน้ำเอ่อ หมูเด้งกับแม่ว่ายเล่น มีเป็ด ห่าน กบ เต่า ปลา และจระเข้ซุ่มอยู่ เด็กน้อยขี้กลัวยืนดูอยู่ริมบึง",
    en: "Moo Deng's pond in the rain and rising water: she and her mother splash about among ducks, geese, frogs, a turtle and fish — with a crocodile lurking, and a nervous child watching from the bank.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up", "ระวังจระเข้ · Watch out for the crocodile"],
  },
  "scene-village-games": {
    th: "ลานกีฬาหมู่บ้านใต้แสงไฟฟ้า มีวงเตะตะกร้อ โต๊ะปิงปอง และแม่ค้ากระโดดเชือก ศาลาให้นั่งพัก และหมาไทยวิ่งเล่น",
    en: "The village sports ground under electric light: a takraw circle, a ping-pong table, a market woman skipping rope, a sala for resting and a Thai dog romping about.",
    tips: ["ล้างจอแล้วจัดฉากให้ทั้งหมด · Clears the cloth and sets everything up", "ลองเพิ่มคนเตะตะกร้อเป็นวงใหญ่ · Add more takraw players for a bigger circle"],
  },
};

export const MOVE_INFO = {
  // ---------------------------------------------------------------- fight
  strike: { th: "เงื้อแขนขึ้นแล้วฟันลงเต็มแรง ท่าโจมตีหลักของนักดาบ (ปุ่ม 1 หรือกำปั้น ✊)", en: "Raise the arm and bring it down in a full overhead chop — the swordsman's main attack (key 1, or a fist ✊).", cat: "fight" },
  lunge: { th: "ก้าวเท้าหน้าพุ่งตัวแทงตรงไปข้างหน้า เหมาะกับหอกและอาวุธปลายแหลม (ปุ่ม 2 หรือชี้นิ้ว ☝)", en: "Step forward and drive a straight thrust — best with spears and points (key 2, or a pointing finger ☝).", cat: "fight" },
  block: { th: "ยกแขนและอาวุธขึ้นปัดป้องคมที่ฟาดมา ลดแรงที่โดนลงมาก (ปุ่ม 3 หรือแบมือ ✋)", en: "Raise arm and weapon to parry an incoming blow, cutting the damage sharply (key 3, or an open hand ✋).", cat: "fight" },
  sweep: { th: "ย่อตัวต่ำแล้วฟันกวาดเข้าที่ขา ใช้เมื่อคู่ต่อสู้ตั้งการ์ดสูง", en: "Drop low and slash a sweeping cut at the legs — used when the foe guards high.", cat: "fight" },
  "stab-down": { th: "ยกอาวุธขึ้นเหนือหัวแล้วแทงลงใส่คู่ต่อสู้ที่ล้มอยู่บนพื้น", en: "Lift the weapon overhead and stab down at a foe lying on the ground.", cat: "fight" },
  evade: { th: "ก้าวถอยหลังอย่างรวดเร็วให้พ้นระยะคมอาวุธของศัตรู", en: "A quick step back out of the enemy's reach.", cat: "fight" },
  hit: { th: "สะดุ้งเซถอยหลังเมื่อโดนตีหรือฟัน", en: "Flinch and stagger back after being struck.", cat: "fight" },
  roar: { th: "อ้าปากกว้าง ยกแขนกางเล็บคำรามจนจอสั่น ท่าประจำตัวของยักษ์ (ปุ่ม 7 หรือชูนิ้วเขา 🤘)", en: "Jaws wide, claws up, a roar that shakes the screen — the demon's signature (key 7, or horns 🤘).", cat: "fight" },
  leap: { th: "ย่อเข่าแล้วกระโดดสูงพุ่งไปข้างหน้า ใช้ทั้งหลบและเข้าประชิด (ปุ่ม 6 หรือชูสองนิ้ว ✌)", en: "Crouch and spring high and forward, to dodge or close in (key 6, or a victory sign ✌).", cat: "fight" },

  // ---------------------------------------------------------------- dance
  dance: { th: "รำไทยพื้นฐาน มือจีบสลับตั้งวง ย่อยืดเข่าตามจังหวะ (ปุ่ม 4 หรือมือจีบ)", en: "A basic Thai dance: hands alternate jeeb and wong while the knees dip on the beat (key 4, or a jeeb hand).", cat: "dance" },
  wong: { th: "ท่าตั้งวง มือแบนิ้วชิดหักข้อมือไปข้างหลัง แขนโค้งเป็นวง พร้อมยกเท้ากระดก (ปุ่ม 9)", en: "The tang-wong pose: fingers together, wrist bent back, the arm curved in a ring, with one foot lifted and flexed (key 9).", cat: "dance" },
  "ram-theppranom": { th: "เทพประนม พนมมือไว้ระดับอกเหมือนเทวดาไหว้ ย่อเข่าก้าวเท้าแตะส้นอย่างนุ่มนวล ท่าเปิดของการรำแม่บท", en: "Thep Pranom, deva in prayer: palms joined at the chest like a worshipping deva, knees dipping and heel steps soft — the opening of the mother dances.", cat: "dance" },
  "ram-phromsina": { th: "ปฐมพรหมสี่หน้า ยกสองแขนตั้งวงสูงเหนือศีรษะ ประหนึ่งพระพรหมผู้มีสี่พักตร์มองทุกทิศ", en: "Pathom Phrom Si Na, the four-faced Brahma: both arms raised in high rings above the head, like Brahma gazing in all four directions.", cat: "dance" },
  "ram-sodsoi": { th: "สอดสร้อยมาลา มือหนึ่งตั้งวงสูง อีกมือจีบสอดผ่านลงมาเหมือนร้อยพวงมาลัย สลับซ้ายขวาพร้อมกระดกเท้า", en: "Sod Soi Mala, threading the garland: one hand held high in a ring while the other passes through in a jeeb, as if threading flowers, changing sides with a lifted foot.", cat: "dance" },
  "ram-kinnorn": { th: "กินนรเลียบถ้ำ แขนหน้ายื่นตั้งวง แขนหลังเหยียดไปด้านหลังเหมือนปีก ก้าวย่องเหมือนกินนรีเดินเลียบปากถ้ำ", en: "Kinnorn Liap Tham: the front arm reaching forward in a ring, the back arm swept behind like a wing, stepping softly like a kinnari skirting a cave mouth.", cat: "dance" },
  "ram-chanee": { th: "ชะนีร่ายไม้ แขนหนึ่งชูสูงอีกแขนเหวี่ยงไปข้างหลัง สลับกันเหมือนชะนีโหนกิ่งไม้ไปมา", en: "Chanee Rai Mai: one arm high, the other swung back, changing over and over like a gibbon swinging branch to branch.", cat: "dance" },
  "ram-kwang": { th: "กวางเดินดง มือหน้าจีบยกสูงเหมือนเขากวาง มือหลังตั้งวงต่ำ ก้าวย่างเบา ๆ ตามจังหวะ", en: "Kwang Doen Dong: the front hand raised in a jeeb like a deer's antler, the back hand in a low ring, stepping lightly on the beat.", cat: "dance" },
  "ram-phala": { th: "ผาลาเพียงไหล่ แขนหน้าตั้งวงระดับไหล่ แขนหลังเหยียดตึงไปด้านหลังเหมือนคันไถ โน้มตัวไปข้างหน้า", en: "Phala Phiang Lai: the front arm ringed at shoulder height, the back arm stretched straight behind like a plough handle, body leaning forward.", cat: "dance" },
  "ram-nakha": { th: "นาคาม้วนหาง แขนหน้าวาดขึ้นแล้วม้วนลงเป็นวงคล้ายพญานาคม้วนหาง ลำตัวเอียงตามอย่างพลิ้วไหว", en: "Nakha Muan Hang: the front arm sweeps up and curls down in a coil like a naga winding its tail, the body swaying with it.", cat: "dance" },
  "ram-lokaew": { th: "ล่อแก้ว มือหลังตั้งวงสูงค้างไว้ มือหน้าจีบยื่นออกแล้วดึงกลับเหมือนล่อดวงแก้ว เอนตัวไปมา", en: "Lo Kaew, luring the crystal: the back hand held high in a ring while the front hand reaches out in a jeeb and draws back as if tempting a jewel, leaning to and fro.", cat: "dance" },
  "ram-mangkorn": { th: "มังกรเรียงหาง สองแขนตั้งวงยื่นไปข้างหน้าเรียงกัน โน้มตัวต่ำแล้วยืดขึ้นเป็นลูกคลื่นเหมือนลำตัวมังกร", en: "Mangkorn Riang Hang: both ringed arms reach forward in line while the body dips and rises in a wave like a dragon's length.", cat: "dance" },
  "ram-medley": { th: "รำชุด ร้อยเรียงแม่ท่าหลายท่าต่อกันเป็นการแสดงยาวไม่สะดุด", en: "A dance suite chaining several classical mother-poses into one long, seamless performance.", cat: "dance" },

  // ---------------------------------------------------------------- gesture
  wai: { th: "พนมมือยกขึ้นไหว้แล้วก้มศีรษะลง การทักทายแสดงความเคารพแบบไทย (ปุ่ม 5 หรือพนมมือ 🙏)", en: "Palms pressed together and raised as the head bows — the respectful Thai greeting (key 5, or praying hands 🙏).", cat: "gesture" },
  bow: { th: "ค้อมตัวคำนับลงช้า ๆ แล้วยืดตัวขึ้น ใช้ขอบคุณผู้ชมเมื่อจบการแสดง (ปุ่ม 0)", en: "A slow bow from the waist and back up — thanking the audience at curtain call (key 0).", cat: "gesture" },
  laugh: { th: "เงยหน้าหัวเราะลั่น ตัวโยกตามเสียงหัวเราะ ท่าถนัดของตัวตลก (ปุ่ม 8 หรือยกนิ้วโป้ง 👍)", en: "Head thrown back in a belly laugh, the whole body shaking — a clown favourite (key 8, or a thumbs-up 👍).", cat: "gesture" },
  wave: { th: "ยกมือโบกไปมาทักทายหรือบอกลา", en: "Raise a hand and wave hello or goodbye.", cat: "gesture" },
  point: { th: "ยื่นแขนชี้นิ้วไปข้างหน้าค้างไว้ ใช้ถามราคาของหรือชี้ทาง", en: "Stretch out an arm and hold a pointing finger — to ask a price or show the way.", cat: "gesture" },
  cheer: { th: "ชูแขนขึ้นดีใจกระโดดเบา ๆ เมื่อสิ่งดี ๆ เกิดขึ้น", en: "Throw up both arms and bounce for joy when something good happens.", cat: "gesture" },
  beckon: { th: "กวักมือเรียกลูกค้าเข้ามาที่ร้าน ท่าประจำของแม่ค้า", en: "Wave customers over to the stall — the market vendor's move.", cat: "gesture" },
  flee: { th: "ยกแขนตื่นตระหนกแล้ววิ่งหนีไม่คิดชีวิต", en: "Arms up in alarm and running for dear life.", cat: "gesture" },
  "look-around": { th: "หันซ้ายหันขวามองไปรอบ ๆ อย่างสงสัย", en: "Turn the head left and right, looking around curiously.", cat: "gesture" },

  // ---------------------------------------------------------------- posture
  sit: { th: "ย่อตัวลงนั่งพักแล้วค้างท่าไว้ ใช้นั่งคุยกันกับเพื่อน", en: "Lower down into a seated rest and hold it — for sitting and chatting with a friend.", cat: "posture" },
  kneel: { th: "นั่งพับเพียบ พับขาไปด้านข้างอย่างสุภาพ ท่านั่งแบบไทยต่อหน้าพระหรือผู้ใหญ่", en: "Kneel in phap phiap, legs folded neatly to one side — the polite Thai way to sit before monks or elders.", cat: "posture" },

  // ---------------------------------------------------------------- social
  handshake: { th: "เดินเข้าหากันแล้วยื่นมือหน้าจับมือเขย่าขึ้นลง", en: "Step close, clasp front hands and pump them up and down.", cat: "social" },
  highfive: { th: "ยกมือขึ้นสูงแล้วแปะมือกันดังเปาะ", en: "Raise a hand high and slap palms together with a smack.", cat: "social" },
  hug: { th: "อ้าแขนโอบกอดเพื่อนที่คิดถึงไว้แน่น", en: "Open the arms wide and wrap a long-missed friend in a hug.", cat: "social" },
  talk: { th: "หันหน้าเข้าหากัน ขยับมือประกอบการพูดคุยไปเรื่อย ๆ", en: "Face each other and gesture along as the conversation flows.", cat: "social" },

  // ---------------------------------------------------------------- sport
  kick: { th: "เตะแป ยกเข่าแล้ววาดเท้าใช้ข้างในเท้ารับส่งลูกตะกร้อขึ้นข้างหน้า", en: "The inside-foot takraw kick: lift the knee and swing the inner foot up to pass the ball.", cat: "sport" },
  knee: { th: "เดาะเข่า ยกเข่าสูงรับลูกตะกร้อให้เด้งขึ้นกลางอากาศ", en: "A knee juggle: lift the knee high to bounce the takraw ball back up.", cat: "sport" },
  header: { th: "โหม่ง กระโดดขึ้นเล็กน้อยแล้วผงกหัวส่งลูกตะกร้อ", en: "A header: a little jump and a nod to send the takraw ball on.", cat: "sport" },
  forehand: { th: "ตีลูกปิงปองโฟร์แฮนด์ เหวี่ยงไม้จากต่ำขึ้นสูงส่งลูกข้ามเน็ต", en: "A ping-pong forehand: swing the paddle from low to high to drive the ball over the net.", cat: "sport" },

  // ---------------------------------------------------------------- animal
  hop: { th: "กระโดดเหยงเล่นเบา ๆ ด้วยความดีใจหรือตื่นเต้น", en: "A small happy bounce of excitement.", cat: "animal" },
  "ai-pounce": { th: "ย่อตัวแล้วพุ่งตะปบเหยื่อด้วยอุ้งเท้าและปากอ้า ท่าล่าของเสือ", en: "Crouch, then spring on the prey with claws out and jaws open — the tiger's hunting strike.", cat: "animal" },
  "ai-lunge": { th: "พุ่งไปข้างหน้าแล้วงับเร็วเหมือนจระเข้ฉกเหยื่อที่ริมน้ำ", en: "Lunge forward and snap the jaws shut, like a crocodile striking from the bank.", cat: "animal" },
  "ai-bite": { th: "งับเล่นเบา ๆ แบบหมูเด้งงับขาคนเลี้ยง", en: "A cheeky little nibble, the way Moo Deng chomps her keeper's legs.", cat: "animal" },
  "ai-peck": { th: "กระโดดขึ้นเตะเดือยใส่คู่ต่อสู้ ท่าตีกันของไก่ชน", en: "Leap up and strike with the spurs — the fighting cock's kick.", cat: "animal" },
};

export const CAT_INFO = {
  scenes: { th: "ฉากสำเร็จรูป เลือกแล้วจอจะล้าง จัดแสง สภาพอากาศ ฉาก สัตว์ และตัวหนังพร้อมบทบาทให้ทันที", en: "Ready-made scenes: pick one and the cloth clears, then the light, weather, set, animals and cast with their roles are laid out for you." },
  puppets: { th: "ตัวหนังทั้งหมด ทั้งตัวละครรามเกียรติ์ ตัวตลกหนังตะลุงภาคใต้ และชาวบ้าน ลากลงจอแล้วเชิดได้เลย", en: "All the puppets — Ramakien heroes and demons, southern shadow-play clowns and villagers. Drag one onto the cloth and start performing." },
  tools: { th: "เอฟเฟกต์ประกอบฉาก ไฟจริง ควัน น้ำ น้ำพุ ดวงไฟสี และประกายเวทย์", en: "Stage effects: real fire, smoke, water, a fountain, coloured lights and magic sparkles." },
  weather: { th: "ลมฟ้าอากาศและแสงของวัน วางหนึ่งครั้งเพื่อเปิด วางอีกครั้งเพื่อปิด", en: "Weather and time of day — drop one to switch it on, drop it again to switch it off." },
  magic: { th: "เวทมนตร์ วางบนตัวหนังเพื่อปลุกเสกวิญญาณ ลงยันต์ ชุบชีวิต หรืออัญเชิญสิ่งใหม่", en: "Spells — drop one on a puppet to give it a soul, ward it, heal it, or summon something new." },
  imports: { th: "รูปภาพที่นำเข้าจากเครื่องของคุณเพื่อใช้เป็นอุปกรณ์ประกอบฉาก", en: "Images you've imported from your own device to use as props." },
  weapons: { th: "อาวุธไทยโบราณ วางที่มือตัวหนังเพื่อถือ มีทั้งของมีคม ปลายแหลม และอาวุธทื่อ", en: "Classical Thai weapons — drop one on a puppet's hand. Blades cut, points pierce, blunt weapons bruise." },
  market: { th: "ของในตลาด แผงลอย ร่มแม่ค้า หาบเร่ และสินค้า แม่ค้าจะมายืนขายข้างแผง", en: "Market things — stalls, vendor umbrellas, carrying poles and goods; merchants come to stand beside them." },
  food: { th: "อาหารและผลไม้ไทย ถือได้ วางให้แม่ค้าขาย หรือให้ตัวตลกหิวโซ", en: "Thai food and fruit — to hold, to stock a merchant's stall, or to tempt a hungry clown." },
  household: { th: "ข้าวของเครื่องใช้ในบ้านและวัด โอ่ง ตะเกียง พัด ร่ม กระทง และโคมลอย", en: "Things of home and temple — water jars, lamps, fans, umbrellas, krathong and sky lanterns." },
  instruments: { th: "เครื่องดนตรีไทย คลิกหรือลากเพื่อบรรเลง ตั้งแต่วงปี่พาทย์จนถึงวงหนังตะลุง", en: "Thai instruments — click or drag to play, from the piphat ensemble to the shadow-play band." },
  animals: { th: "สัตว์ที่มีนิสัยของตัวเอง เดินเป็นฝูง หนีภัย ล่าเหยื่อ หลับกลางคืน และว่ายน้ำตอนน้ำท่วม", en: "Animals with minds of their own — they herd, flee danger, hunt, sleep at night and swim in floods." },
  monsters: { th: "อมนุษย์และสัตว์ในตำนาน พญานาค มังกร ครุฑ ผีกระสือ เปรต และผีตาโขน สัตว์ทั้งหลายจะหวาดกลัว", en: "Spirits and mythical beasts — naga, dragon, garuda, krasue, pret and Phi Ta Khon. Every animal fears them." },
  buildings: { th: "บ้าน วัด และสิ่งปลูกสร้าง จะค่อย ๆ สร้างขึ้นจากนั่งร้านไม้ไผ่เมื่อวางลงจอ", en: "Houses, temples and structures — each rises out of bamboo scaffolding when placed." },
  boats: { th: "เรือไทย ลอยน้ำได้และลอยขึ้นตามระดับน้ำท่วม", en: "Thai boats — they float, and rise with a flood." },
  nature: { th: "ธรรมชาติและชนบท ภูเขาลายไทย ก้อนหิน ดวงอาทิตย์ ดวงจันทร์ เมฆ ทุ่งนา และกังหันน้ำ", en: "Nature and countryside — mural mountains, rocks, sun and moon, clouds, paddies and a water wheel." },
  foliage: { th: "ต้นไม้และพืชพรรณที่โยกไหวตามลม และโยกแรงเมื่อพายุเข้า", en: "Trees and plants that sway in the wind, and thrash when a storm comes." },
  games: { th: "กีฬาพื้นบ้าน ตะกร้อ ปิงปอง และกระโดดเชือก ให้เทวดาบทนักกีฬาแล้วตัวหนังจะเล่นกันเอง", en: "Folk sports — takraw, ping-pong and jump rope. Give puppets a sports role and they play on their own." },
  vehicles: { th: "พาหนะ เกวียน สามล้อ ตุ๊กตุ๊ก และจักรยาน ล้อหมุนกลิ้งได้จริง", en: "Vehicles — ox cart, samlor, tuk-tuk and bicycle, with wheels that really roll." },
};
