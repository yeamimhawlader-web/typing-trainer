/**
 * The advanced practice vocabulary: a wider set of everyday English words.
 *
 * Common words from beyond the two hundred most frequent, the sort any adult
 * reads every day, and on average half as long again as those. They bring the
 * letter combinations the frequent words never reach, so they train the hands
 * across more of the keyboard. None of them is in the normal list (`word-list.ts`):
 * choosing Advanced is choosing different words, not a mix.
 *
 * Kept as one block of text rather than a line a word: over a thousand words,
 * split once when the module loads.
 */

export const ADVANCED_WORDS: readonly string[] = `
ability absence academy accept access accident account achieve acquire action
active actually address admire advance advice affect afford afraid against
agency agenda ahead airline alive allow almost alone along already although
always amazing amount analysis ancient anger angle animal annual another
answer anxiety anybody anyway apart apparent appeal apply approach approve
argue arrange arrive article artist aspect assess assume attack attempt attend
attitude attract audience author autumn available average avoid award aware
balance barrier basket battery beautiful bedroom behave behind beneath benefit
beside beyond bicycle billion biology blanket border borrow bottle bottom
boundary branch breakfast breathe bridge brief bright brilliant brother budget
building burden business butter button cabinet calendar camera campaign cancel
candle capable capital captain carbon career careful carpet castle category
ceiling celebrate center central century ceremony certain chairman challenge
champion channel chapter character charge charity cheap chemical chicken
children chocolate choice circle citizen civil claim classic climate clinic
clothes coffee collapse colleague collect college colony column combine
comfort command comment commit community company compare compete complain
complete complex computer concept concern concert conclude condition conduct
confirm conflict connect constant contain content context contract control
convince cooking corner correct cottage council county couple courage course
cousin credit crisis critic crowd crucial culture curious current custom
customer damage danger daughter dealer debate decade declare decline decrease
defeat defend define degree deliver demand depend deposit depth describe
desert design desire detail detect develop device dialogue diamond differ
digital dinner direct director discover discuss disease display distance
distinct district divide doctor document domestic dominate double dozen drama
dramatic drawing driver during earn economy edition editor educate effect
effort eight either elderly elect element eleven eliminate elsewhere embrace
emerge emotion emphasis empire employ enable encounter encourage energy engage
engine enhance enormous enough ensure enter entire entrance envelope episode
equal equipment escape especially essay essential establish estate estimate
evening event eventually evidence evolve exact examine example exceed
excellent except exchange exciting executive exercise exhibit exist expand
expect expense expert explore export expose express extend extra extreme
fabric factor factory faculty failure familiar famous fantasy farmer fashion
feather feature federal feeling fellow festival fiction field fifteen fifty
figure final finance finger finish fitness flavor flight float flower focus
football foreign forest forever forget formal format former formula fortune
forward founder fraction freedom frequent friendly frontier frozen fruit
function funding furniture further future galaxy gallery garage garden garlic
gather general generate genius gentle genuine gesture giant glance global
golden govern gradual graduate grammar graphic gravity greatly grocery ground
growth guarantee guardian guess guest guidance guitar habit handle harbor
hardly harmony harvest headline health hearing heaven height helpful heritage
hesitate highway history holiday horizon hospital hotel household housing
however humor hundred hunger husband identify identity ignore illness image
imagine impact implement imply import impose impress improve incident income
increase indeed index indicate industry infant inflation influence inform
initial injury inner innocent inquiry insect inside insight insist inspire
install instance instead institute insurance intend intense interest internal
interview introduce invest invite involve island issue jacket journal journey
judge junior justice justify kitchen knowledge label labor ladder landscape
language largely laughter launch lawyer layer leader league learning leather
lecture legacy legal legend leisure lemon length lesson letter level liberal
library license lifestyle lifetime likely limit liquid listen literary living
local locate logic lonely lovely lucky luxury machine magazine magic maintain
major majority manage manner manual margin market marriage master match
material matter maximum meaning measure medical medium member memory mental
mention message method middle military million mineral minimum minister
minority minute miracle mirror missing mission mistake mixture mobile model
modern modest moment monitor monkey monthly moral morning mostly motion
motivate mountain movement multiple muscle museum music mutual mystery narrow
nation native natural nature nearby nearly necessary negative neighbor neither
nervous network neutral nobody normal northern notable nothing notice notion
novel nuclear numerous nurse object observe obtain obvious occasion occupy
occur ocean office officer official often online opening operate opinion
opponent oppose option orange order ordinary organic origin original outcome
outdoor outside overall overcome owner oxygen package painting palace panel
paper parent parking partner passage passion patient pattern payment peaceful
penalty pepper percent perfect perform perhaps period permit person personal
persuade phase phone photo phrase physical piano picture pilot planet plastic
platform player pleasant pleasure plenty pocket poetry police policy polite
political popular portion portrait position positive possess possible potato
potential poverty powder power practice praise predict prefer prepare presence
present preserve president pressure pretend pretty prevent previous price
pride primary prince principal principle priority prison private prize
probably problem proceed process product profession profile profit program
progress project promise promote proper property proposal protect protein
protest proud prove provide public publish purchase purple purpose pursue
puzzle quality quantity quarter question quick quiet quite quote rabbit
radical radio railway rainbow random range rapid rarely rather rating ratio
react reader ready reality realize reason recall recent recipe record recover
reduce reflect reform refuse regard region regular reject relate relative
release relevant relief religion remark remind remote remove repeat replace
report request require rescue research resident resist resolve resource
respond response restore result retain retire reveal revenue review reward
rhythm river robot rocket romantic rotate rough round routine royal rubber
rural sacred safety salary sample sandwich satisfy sauce scale scenario
schedule scheme scholar science scratch screen script season second secret
section sector secure segment select senior sense sentence separate sequence
series serious servant service session setting settle seven several severe
shadow shallow shelter shift shoulder signal silence silver similar simple
simply single sister situation sketch skill slender slight smooth social
society soldier solid solution somebody somewhat source southern space speaker
special species specific spectrum speech spirit spread spring square stable
stadium stage standard station statue status steady stomach storage strange
stranger strategy stream street strength stretch strict strike string strong
structure student studio subject submit succeed success sudden suffer sugar
summer summit supply suppose surface surprise surround survey survive suspect
sustain symbol system table talent target teacher teaspoon technique teenager
telephone temple tender tension terrible territory theater theory therapy
thinking thirty thought thousand threat throw ticket timber tissue title
together tomato tomorrow tongue tonight topic total toward towel tower
tradition traffic trail training transfer transform travel treasure treatment
triangle tribute trouble truly trust truth tunnel twelve twenty typical
umbrella uncle unique united universe unknown unless unlike until unusual
update upper urban useful usual valley valuable variety various vehicle
venture version vessel victory village virtual virtue visible vision visitor
visual vital voice volume volunteer wander warning weather website wedding
weekend weight welcome western whatever wheel whisper whole widely window
winner winter wisdom within without witness wonder wooden worker workshop
worried worth writer writing yellow yesterday young youth zone
`
  .trim()
  .split(/\s+/)
