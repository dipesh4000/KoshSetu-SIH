const portrait = '/assets/ambedkar-portrait-demo.png';
const assembly = '/assets/constituent-assembly-demo.png';
const manuscript = '/assets/manuscript-demo.png';

export const records = [
  {
    id: 'A-001', title: 'Annihilation of Caste', type: 'Writing', mediaKind: 'Document', year: '1936',
    description: 'The undelivered address that became Ambedkar’s most influential critique of caste and graded inequality.',
    tags: ['Caste', 'Equality', 'Social Reform'], imageUrl: manuscript, verified: true,
    viewerText: [
      'Caste is not merely a division of labour. It is also a division of labourers. It is a hierarchy in which the divisions of labourers are graded one above the other.',
      'The real remedy for breaking caste is inter-marriage. Nothing else will serve as the solvent of caste.',
      'You cannot build anything on the foundations of caste. You cannot build up a nation, you cannot build up a morality.',
    ],
    translation: [
      'जाति केवल श्रम का विभाजन नहीं है। यह श्रमिकों का भी विभाजन है और ऐसी श्रेणीबद्ध व्यवस्था है जिसमें लोगों को ऊँचा और नीचा माना जाता है।',
      'जाति को समाप्त करने का वास्तविक उपाय अंतर्जातीय विवाह है। इसके अतिरिक्त कोई दूसरा साधन जाति को नहीं मिटा सकता।',
      'जाति की नींव पर न राष्ट्र का निर्माण हो सकता है, न नैतिकता का।',
    ],
    aiInsight: 'Ambedkar treats caste as a system of ranked social separation. The text connects personal dignity, social equality and the possibility of democratic nationhood.',
  },
  {
    id: 'A-002', title: 'The Buddha and His Dhamma', type: 'Book', mediaKind: 'Book', year: '1957',
    description: 'Ambedkar’s final work: an account of the Buddha’s life and a reconstruction of Dhamma for the modern world.',
    tags: ['Buddhism', 'Dhamma', 'Philosophy'], imageUrl: portrait, verified: true,
    pdfUrl: '/assets/documents/the-buddha-and-his-dhamma.pdf', pageCount: 347,
    viewerText: [
      'I regard the Buddha’s Dhamma to be the best. If a modern person who knows science must have a religion, the religion of the Buddha offers a path grounded in reason and ethical life.',
      'The book presents the Buddha’s life, the meaning of Dhamma, the Sangh, and the social responsibilities of a Buddhist way of life.',
    ],
    translation: [
      'मैं बुद्ध के धम्म को सर्वोत्तम मानता हूँ। विज्ञान को जानने वाले आधुनिक मनुष्य के लिए बुद्ध का मार्ग तर्क, करुणा और नैतिक जीवन पर आधारित है।',
      'यह पुस्तक बुद्ध के जीवन, धम्म के अर्थ, संघ और बौद्ध जीवन के सामाजिक उत्तरदायित्व को प्रस्तुत करती है।',
    ],
    aiInsight: 'The work reframes Buddhism around morality, reason and social transformation. It is deeply connected to Ambedkar’s search for liberty, equality and fraternity.',
  },
  {
    id: 'A-003', title: 'Objectives Resolution Debate', type: 'Constitutional Debate', mediaKind: 'Document', year: '1946',
    description: 'An intervention during the deliberations that shaped the foundational principles of independent India.',
    tags: ['Constitution', 'Democracy', 'Objectives'], imageUrl: assembly, verified: true,
    viewerText: ['Ambedkar urged the Assembly to create conditions for cooperation while ensuring that constitutional promises could be trusted by minorities and excluded communities.'],
    translation: ['अम्बेडकर ने सभा से सहयोग की परिस्थितियाँ बनाने और यह सुनिश्चित करने का आग्रह किया कि संवैधानिक वादों पर अल्पसंख्यक तथा वंचित समुदाय भरोसा कर सकें।'],
    aiInsight: 'The intervention shows Ambedkar balancing constitutional principle with the practical task of building trust among communities entering a new political order.',
  },
  {
    id: 'A-004', title: 'Final Speech to the Constituent Assembly', type: 'Speech', mediaKind: 'Audio', year: '1949',
    description: 'The closing address before adoption of the Constitution and a warning about democracy without social equality.',
    tags: ['Liberty', 'Equality', 'Fraternity'], imageUrl: assembly, verified: true, duration: '38:12',
    viewerText: [
      'Political democracy cannot last unless there lies at the base of it social democracy.',
      'Social democracy means a way of life which recognises liberty, equality and fraternity as the principles of life.',
      'On the 26th of January 1950, we are going to enter into a life of contradictions.',
    ],
    translation: ['राजनीतिक लोकतंत्र तब तक टिक नहीं सकता जब तक उसके आधार में सामाजिक लोकतंत्र न हो।', 'सामाजिक लोकतंत्र जीवन की वह पद्धति है जो स्वतंत्रता, समानता और बंधुत्व को जीवन के सिद्धांतों के रूप में स्वीकार करती है।', '26 जनवरी 1950 को हम विरोधाभासों से भरे जीवन में प्रवेश करने जा रहे हैं।'],
    aiInsight: 'This speech warns that constitutional equality can be undermined when social and economic life remains unequal. Democracy must therefore be practiced as a social ethic.',
  },
  {
    id: 'A-005', title: 'Speech at Mahad Satyagraha', type: 'Speech', mediaKind: 'Audio', year: '1927',
    description: 'A mobilisation for equal access to the Chavdar water tank and a landmark assertion of civil rights.',
    tags: ['Mahad', 'Civil Rights', 'Satyagraha'], imageUrl: portrait, verified: true, duration: '22:45',
    viewerText: ['We are not fighting for personal glory. We are fighting for the right to be treated as human beings.', 'The water in this tank is public water. No law can deny us the right to drink from it.'],
    translation: ['हम व्यक्तिगत गौरव के लिए नहीं लड़ रहे हैं। हम मनुष्य के रूप में व्यवहार किए जाने के अधिकार के लिए लड़ रहे हैं।', 'इस तालाब का पानी सार्वजनिक है। कोई भी कानून हमें इसे पीने के अधिकार से वंचित नहीं कर सकता।'],
    aiInsight: 'Mahad translated an abstract claim to equality into direct collective action around an everyday public resource: water.',
  },
  {
    id: 'A-006', title: 'Babasaheb Ambedkar', type: 'Documentary', mediaKind: 'Video', year: '1981',
    description: 'A documentary portrait tracing Ambedkar’s public life, constitutional work and continuing democratic legacy.',
    tags: ['Documentary', 'Biography', 'Legacy'], imageUrl: assembly, verified: true, duration: '15:19',
    viewerText: [
      'This archival documentary follows Bhimrao Ramji Ambedkar from his early education to his work as a jurist, social reformer and principal architect of the Constitution of India.',
      'Its visual record connects the struggle against caste with Ambedkar’s wider arguments for representation, education and constitutional democracy.',
      'The closing sequence considers how liberty, equality and fraternity remain active responsibilities for every generation.',
    ],
    translation: [
      'यह अभिलेखीय वृत्तचित्र भीमराव रामजी अम्बेडकर की प्रारंभिक शिक्षा से लेकर विधिवेत्ता, समाज सुधारक और भारतीय संविधान के प्रमुख शिल्पकार के रूप में उनके कार्य तक की यात्रा दिखाता है।',
      'इसका दृश्य अभिलेख जाति-विरोधी संघर्ष को प्रतिनिधित्व, शिक्षा और संवैधानिक लोकतंत्र के उनके व्यापक विचारों से जोड़ता है।',
      'अंतिम भाग बताता है कि स्वतंत्रता, समानता और बंधुत्व हर पीढ़ी की सक्रिय जिम्मेदारी हैं।',
    ],
    aiInsight: 'The documentary works as a visual gateway into Ambedkar’s linked roles as scholar, organiser and constitutional thinker. Its claims can be followed into the primary records in this kiosk.',
  },
  {
    id: 'A-007', title: 'States and Minorities', type: 'Memorandum', mediaKind: 'Document', year: '1947',
    description: 'A memorandum proposing constitutional safeguards and economic democracy for minorities.',
    tags: ['Minorities', 'Economy', 'Safeguards'], imageUrl: manuscript, verified: true,
    viewerText: ['The memorandum links political safeguards with economic arrangements, arguing that formal rights require institutions capable of protecting people from domination.'],
    translation: ['यह ज्ञापन राजनीतिक सुरक्षा को आर्थिक व्यवस्था से जोड़ता है और बताता है कि औपचारिक अधिकारों के लिए ऐसे संस्थानों की आवश्यकता है जो लोगों को प्रभुत्व से बचा सकें।'],
    aiInsight: 'The document expands minority protection beyond representation and into material conditions, public institutions and economic power.',
  },
  {
    id: 'A-009', title: 'Castes in India', type: 'Article', mediaKind: 'Document', year: '1916',
    description: 'An early academic paper on caste formation, endogamy and social stratification, presented at Columbia University.',
    tags: ['Sociology', 'Caste', 'Columbia'], imageUrl: manuscript, verified: true,
    viewerText: ['Ambedkar approached caste as a social mechanism maintained through endogamy. The paper established an analytical foundation for arguments he would develop throughout his life.'],
    translation: ['अम्बेडकर ने जाति को अंतर्विवाह से बनाए रखी जाने वाली सामाजिक व्यवस्था के रूप में समझा। इस लेख ने उनके जीवन भर विकसित होने वाले तर्कों की विश्लेषणात्मक नींव रखी।'],
    aiInsight: 'The paper analyses how caste reproduces itself, not only how it appears. Endogamy becomes the key mechanism in that explanation.',
  },
  {
    id: 'A-010', title: 'Pakistan or the Partition of India', type: 'Book', mediaKind: 'Book', year: '1940',
    description: 'A rigorous study of communal politics, constitutional arrangements and the logic of partition.',
    tags: ['Politics', 'Partition', 'Communalism'], imageUrl: portrait, verified: false,
    viewerText: ['Ambedkar examined competing political claims through history, demographics and constitutional design, insisting that difficult political questions be evaluated without sentimentality.'],
    translation: ['अम्बेडकर ने इतिहास, जनसांख्यिकी और संवैधानिक संरचना के माध्यम से प्रतिस्पर्धी राजनीतिक दावों का विश्लेषण किया।'],
    aiInsight: 'The book demonstrates Ambedkar’s method: define the political problem precisely, test available arrangements and examine consequences for every affected community.',
  },
];

export const timelineEvents = [
  { id: 't1', date: '14 April 1891', decade: 'Pre-1900', year: '1891', title: 'Birth in Mhow', body: 'Bhimrao Ramji Ambedkar was born in Mhow, Central Provinces, into a Mahar family. His experience of exclusion would shape a lifelong struggle for dignity and equal citizenship.', relatedRecord: 'A-009' },
  { id: 't2', date: '1913', decade: '1910s', year: '1913', title: 'Studies at Columbia University', body: 'Ambedkar arrived in New York for postgraduate study at Columbia University, studying economics, sociology, history and philosophy.', relatedRecord: 'A-009' },
  { id: 't3', date: '1916', decade: '1910s', year: '1916', title: 'Castes in India paper', body: 'He presented his seminal analysis of caste and enforced endogamy at an anthropology seminar at Columbia.', relatedRecord: 'A-009' },
  { id: 't4', date: '1923', decade: '1920s', year: '1923', title: 'The Problem of the Rupee', body: 'Ambedkar completed his major work on monetary economics at the London School of Economics.', relatedRecord: 'A-007' },
  { id: 't5', date: '20 March 1927', decade: '1920s', year: '1927', title: 'Mahad Satyagraha', body: 'Ambedkar led thousands to the Chavdar tank to assert equal access to public water and equal civic status.', relatedRecord: 'A-005' },
  { id: 't6', date: '1936', decade: '1930s', year: '1936', title: 'Annihilation of Caste', body: 'After organisers cancelled his invitation rather than accept the address, Ambedkar published the text himself.', relatedRecord: 'A-001' },
  { id: 't7', date: '1940', decade: '1940s', year: '1940', title: 'Pakistan or the Partition of India', body: 'Ambedkar published his extensive study of communal politics, constitutional arrangements and partition.', relatedRecord: 'A-010' },
  { id: 't8', date: '1946–1949', decade: '1940s', year: '1947', title: 'Drafting the Constitution', body: 'As Chairman of the Drafting Committee, Ambedkar helped shape fundamental rights, constitutional remedies and the abolition of untouchability.', relatedRecord: 'A-003' },
  { id: 't9', date: '25 November 1949', decade: '1940s', year: '1949', title: 'Final Assembly speech', body: 'His closing address warned that political equality could not endure alongside deep social and economic inequality.', relatedRecord: 'A-004' },
  { id: 't10', date: '14 October 1956', decade: '1950s', year: '1956', title: 'Conversion to Buddhism', body: 'At Nagpur, Ambedkar embraced Buddhism with a vast gathering, presenting Dhamma as a path to dignity and liberation.', relatedRecord: 'A-002' },
  { id: 't11', date: '6 December 1956', decade: '1950s', year: '1956', title: 'Mahaparinirvana', body: 'Ambedkar died in Delhi, leaving a completed manuscript of The Buddha and His Dhamma.', relatedRecord: 'A-002' },
];

export const decades = ['All', 'Pre-1900', '1910s', '1920s', '1930s', '1940s', '1950s'];

export const askDemos = [
  { question: 'Why did Ambedkar argue that political democracy needs social democracy?', questionHi: 'अम्बेडकर ने राजनीतिक लोकतंत्र के लिए सामाजिक लोकतंत्र को आवश्यक क्यों माना?', title: 'Political equality cannot survive without equality in everyday life.', titleHi: 'दैनिक जीवन में समानता के बिना राजनीतिक समानता टिक नहीं सकती।', answer: 'Ambedkar argued that voting rights and constitutional guarantees remain fragile when society is organised through hierarchy. Liberty, equality and fraternity must operate together as a way of life, not only as legal promises.', answerHi: 'अम्बेडकर के अनुसार मतदान का अधिकार और संवैधानिक गारंटी तब कमजोर पड़ जाती हैं जब समाज ऊँच-नीच पर आधारित हो। स्वतंत्रता, समानता और बंधुत्व केवल कानूनी वादे नहीं, जीवन-पद्धति होने चाहिए।', sources: ['A-004', 'A-001', 'A-007'] },
  { question: 'What happened at Mahad in 1927?', questionHi: '1927 में महाड़ में क्या हुआ था?', title: 'Access to water became an assertion of equal citizenship.', titleHi: 'पानी तक पहुँच समान नागरिकता की घोषणा बनी।', answer: 'Ambedkar led thousands of people to drink from the public Chavdar tank at Mahad. The action challenged caste restrictions through a direct claim to civic rights and human dignity.', answerHi: 'अम्बेडकर ने हजारों लोगों के साथ महाड़ के सार्वजनिक चवदार तालाब से पानी लिया। यह कार्रवाई नागरिक अधिकार और मानवीय गरिमा के सीधे दावे के रूप में जातिगत प्रतिबंधों को चुनौती थी।', sources: ['A-005', 'A-001'] },
  { question: 'How did Ambedkar describe caste as a system?', questionHi: 'अम्बेडकर ने जाति व्यवस्था का वर्णन कैसे किया?', title: 'Caste is a graded hierarchy that divides labourers themselves.', titleHi: 'जाति श्रमिकों को बाँटने वाली श्रेणीबद्ध व्यवस्था है।', answer: 'Ambedkar distinguished caste from a simple division of work. It ranks groups, enforces separation and reproduces itself through endogamy, making social reform inseparable from dismantling caste.', answerHi: 'अम्बेडकर ने जाति को केवल काम के विभाजन से अलग बताया। यह समूहों को क्रमबद्ध करती है, अलगाव लागू करती है और अंतर्विवाह के माध्यम से स्वयं को बनाए रखती है।', sources: ['A-001', 'A-009'] },
  { question: 'Why is The Buddha and His Dhamma important?', questionHi: 'द बुद्धा एंड हिज धम्म महत्वपूर्ण क्यों है?', title: 'The book gathers Ambedkar’s ethical and social vision of Buddhism.', titleHi: 'यह पुस्तक बौद्ध धर्म के प्रति अम्बेडकर की नैतिक और सामाजिक दृष्टि प्रस्तुत करती है।', answer: 'Ambedkar presents Dhamma as a rational and ethical path centred on human conduct, compassion and social responsibility. Published after his death, it is the culmination of decades of study and his turn to Buddhism.', answerHi: 'अम्बेडकर धम्म को मानवीय आचरण, करुणा और सामाजिक उत्तरदायित्व पर आधारित तर्कसंगत तथा नैतिक मार्ग के रूप में प्रस्तुत करते हैं।', sources: ['A-002', 'A-001'] },
];

export const copy = {
  ENG: { welcomeEyebrow: 'PUBLIC ARCHIVE · FREE ENTRY', welcomeTitle: 'The Ambedkar Heritage Archive', welcomeBody: 'Writings, debates, speeches and the life journey of Dr. B. R. Ambedkar.', touch: 'Touch to explore the archive', browse: 'Browse the collection', search: 'Search the archive' },
  हिंदी: { welcomeEyebrow: 'सार्वजनिक अभिलेखागार · निःशुल्क प्रवेश', welcomeTitle: 'अम्बेडकर विरासत अभिलेखागार', welcomeBody: 'डॉ. बी. आर. अम्बेडकर के लेखन, वाद-विवाद, भाषण और जीवन यात्रा।', touch: 'अभिलेखागार देखने के लिए स्पर्श करें', browse: 'संग्रह देखें', search: 'अभिलेखागार खोजें' },
};
