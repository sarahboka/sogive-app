package org.sogive.data.charity;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonIOException;

import com.winterwell.es.client.ESConfig;
import com.winterwell.es.client.ESHttpClient;
import com.winterwell.es.client.ESHttpResponse;
import com.winterwell.es.client.IESResponse;
import com.winterwell.es.client.IndexRequestBuilder;
import com.winterwell.es.client.UpdateRequestBuilder;
import com.winterwell.utils.MathUtils;
import com.winterwell.utils.Printer;
import com.winterwell.utils.StrUtils;
import com.winterwell.utils.Utils;
import com.winterwell.utils.containers.Containers;
import com.winterwell.utils.io.CSVReader;
import com.winterwell.utils.time.Time;

import static com.winterwell.utils.containers.Containers.get;

// https://docs.google.com/spreadsheets/d/1Gy4sZv_WZRQzdfwVH0e3tBvyBnuEJnhSFx7_7BHLSDI/edit#gid=0

//Charity Name	Description of the column
//Classification	There's not a fixed taxonomy, but try to use the existing names and separate multiple tags with &
//Reg Num	The registration number with the Charity Commission of England & Wales
//Analyst	Add your name if you've contributed to this data collection!
//Project	This is for when a charity has multiple projects and we've split the analysis up. The Overall category is for the aggregate.
//Year start date	the official timeperiod covered by the report in question.
//Year end date	
//UK-based charity?	I.e. is gift aid availble? (so for example if it's a multinational group with a uk entity, then the answer would be yes)
//CC What	Charity Commission activity classification WHAT
//CC Who	Charity Commission activity classification WHO
//CC How	Charity Commission activity classification HOW
//CC Site	Link to the charity's page on the charity commission website. Only relevant for those which are registered with the charity commission - or if it's a registered charity in Scotland show the relevant page on the OSCR website, and similarly for the charity commission of Northern Ireland
//Source of data (typically annual report)	URL for the source
//Impact 1	number, usually listed in the prose
//Impact 2	Sometimes the accounts will refer to "indirect beneficiaries" - include those here. Alternatively include the knock-on impacts or second order impacts in this column
//Impact 3	
//Impact 4	
//Impact 5	
//Impact 6	
//Annual costs	This is the overall total costs
//Income from Char Act.	Income from Charitable Activities - should include income that's generated by activity that helps beneficiaries (e.g. selling things to beneficiaries). Accounting guidelines encourage charities to show grant funds as "income from charitable activities", so the figures labelled as "income from charitable activities" in accounts are often not what we need. Reviewing the figures by looking at the notes to the accounts often provides the level of detail needed to judge this correctly
//Fundraising costs	May be labelled as something like "costs of generating voluntary income"
//Trading costs	How much of the "cost" quoted was spent on revenue generating trading/business of the charity. Doesn't include trading where the counterparty of the trade is a beneficiary of the charity (i.e. where the trading *is* part of the charitable work) - this would be income from charitable activities instead)
//Costs minus deductions	We deduct the money spent on trading and fundraising to find the money spent on the beneficiaries. The reason for this is just simplicity: if money spent fundraising and on trading just raised itself over again, it'd be the same as if it'd just sat in the bank that year, appearing neither on the cost nor income ledgers.
//Cost per Ben 1	Cost per direct beneficiary
//Cost per Ben 2	Cost per indirect beneficiary.
//Cost per Ben 3	
//Cost per Ben 4	
//Cost per Ben 5	
//Cost per Ben 6	Cost per indirect beneficiary.
//Comments/analysis about the cost per beneficiary figure	
//Total income	For UK charities only
//Voluntary income	For UK charities only
//Reserves	
//Percent	Reserves as % of annual expenditure
//Comments	Source (ie which page number in the accounts) ; what is the target level of the reserves, and how does this compare. If you notice any risks such as underisked pension schemes or FX risk, then mention those here too
//Wording for SoGive app	
//Representative project?	Where a charity has several projects, we may have to choose one as the representative project. For really big mega-charities, it may be necessary to have the "representative" row being an aggregate or "average" of all the projects
//Is this finished/ready to use?	Is there enough data to include in the SoGive app? A judgement
//Confidence indicator	An indicator of the confidence we have in the data, especially the cost per impact
//Comments on confidence indicator	Why?
//Stories	Stories about beneficiaries (either as a link, or copied and pasted - if copied and pasted also include a source). Sometimes this is available in the annual report and accounts, but may need to look on the charity's website
//Images	A link to an image of a beneficiary. Sometimes this is available in the annual report and accounts, but may need to look on the charity's website
//Description of charity	About one sentence long
//Communications with charity	notes about if and when any emails were sent to the charity
//Where hear about?	where we heard about the charity. OK to leave this blank
//Location of intervention	what part of the world the charity interventions are
//External assessments	Links to any external assessments
//Assessment	
//Rating of impactfulness	determined in a very ad-hoc way. Not being used
//Comments about quality of intervention
/**
 * @testedby {@link ImportCharityDataFromCSVTest}
 * @author daniel
 *
 */
public class ImportCharityDataFromCSV {

	static MonetaryAmount cost(Object value) {
		if (value==null) return null;
		return MonetaryAmount.pound(MathUtils.getNumber(value));
	}
	
	public static void main(String[] args) throws Exception {
		File export = new File("data/charities.csv");
		
		ImportCharityDataFromCSV importer = new ImportCharityDataFromCSV(export);
		int cnt = importer.run();
		System.out.println(cnt);
	}

	
	private File csv;
	private ESHttpClient client;

	private List<String> HEADER_ROW;

	public ImportCharityDataFromCSV(File export) {
		this.csv = export;
		assert export.exists() : export;
	}

	public int run() throws Exception {
		init();
		CSVReader csvr = new CSVReader(csv, ',').setNumFields(-1);
		dumpFileHeader(csvr);
		Gson gson = new GsonBuilder()
				.setClassProperty("@type")
				.create();
		int cnt = 0;
		for (String[] row : csvr) {
			// the charity
			if (Utils.isBlank(row[0])) continue;
			String ourid = StrUtils.toCanonical(row[0]).replaceAll("\\s+", "-"); 
			String desc = Containers.get(row, col("desc"));
			String regNum = Containers.get(row, col("reg num"));
			NGO ngo = new NGO(ourid);
			ngo.put(ngo.name, row[0]);
			ngo.put("description", desc);
			ngo.put("englandWalesCharityRegNum", regNum);
			ngo.setTags(row[1]);
			ngo.put("logo", get(row, col("logo image")));
			String ukbased = get(row, col("UK-based charity?"));
			ngo.put("ukBased", ukbased!=null && ukbased.toLowerCase().contains("yes"));
			
//			38	Representative project?	Where a charity has several projects, we may have to choose one as the representative project. For really big mega-charities, it may be necessary to have the "representative" row being an aggregate or "average" of all the projects	yes
//			39	Is this finished/ready to use?	Is there enough data to include in the SoGive app? A judgement	Yes
			String _ready = get(row, col("ready"));
			boolean ready = _ready.toLowerCase().contains("yes");
			String rep = get(row, col("representative")).toLowerCase();
			boolean isRep = rep.toLowerCase().contains("yes");
//			40	Confidence indicator	An indicator of the confidence we have in the data, especially the cost per impact	Low
//			41	Comments on confidence indicator	Why?	The cost shown is based on CR UK funding 4000 researchers for a cost of £600m, minus some deductions to get to £400m. It is not clear whether this is right, for example, those 4000 researchers might include some who are partfunded by other organisations, or it may be that there are 4000 "inhouse" cruk researchers, but CRUK also funds some researchers who work externally, and some of the cruk funds are also partfunding some other researchers outside of the 4000 mentioned in the accounts. When I contacted CRUK for clarity on this, they were unable to clarify the situation
//			42	Stories	Stories about beneficiaries (either as a link, or copied and pasted - if copied and pasted also include a source). Sometimes this is available in the annual report and accounts, but may need to look on the charity's website	
//			43	Images	A link to an image of a beneficiary. Sometimes this is available in the annual report and accounts, but may need to look on the charity's website	
//			44	Description of charity	About one sentence long	A UK charity which primarily funds cancer research
//			45	Communications with charity	notes about if and when any emails were sent to the charity	Request sent via website on 25 Jan 2016 asking for a conversation to talk about how they look at impact. Site says they will reply in 5 days. Reply sent on 15th Feb (while I was travelling, so I didn't see it for a while). The response included several paragraphs, but not one referred to how they assess impact, and I infer that they do not do this. Response email sent on 6th Mar asking about how to compare costs with number of researchers. The people I spoke with demonstrated themselves to be poorly equipped to deal with these questions.
//			46	Where hear about?	where we heard about the charity. OK to leave this blank	
//			47	Location of intervention	what part of the world the charity interventions are	
//			48	External assessments	Links to any external assessments	
//			49	Assessment		C
						
			// Should projects be separate documents??
//			3	Analyst	Add your name if you've contributed to this data collection!	Sanjay
//			4	Project	This is for when a charity has multiple projects and we've split the analysis up. The Overall category is for the aggregate.	Overall
			String analyst = get(row, col("analyst"));
			String projectName = get(row, col("project"));
			if (Utils.isBlank(projectName)) projectName = "overall";
			projectName = StrUtils.toCanonical(projectName);
			Project project = new Project(projectName);
			project.put("analyst", analyst);
			project.put("stories", get(row, col("stories")));
			project.put("stories_src", get(row, col("stories - source")));
			Time start = Time.of(get(row, col("start date")));
			Time end = Time.of(get(row, col("end date")));
			Integer year = end!=null? end.getYear() : null;
			String dataSrc = get(row, col("source of data"));
			if ( ! Utils.isBlank(dataSrc)) {
				Citation citation = new Citation(dataSrc);
				if (year!=null) citation.put("year", year);
				project.addOrMerge("data-src", citation);
			}
			project.put("images", get(row, col("photo image")));
			project.put("location", get(row, col("location")));
			
			// inputs
			for(String cost : new String[]{"annual costs", "fundraising costs", "trading costs", "income from beneficiaries"}) {
				MonetaryAmount ac = cost(get(row, col(cost)));
				ac.setPeriod(start, end);
				String costName = StrUtils.toCamelCase(cost);
				project.addInput(costName, ac);
			}
			
			// outputs
			for(int i=1; i<3; i++) {
				double impact1 = MathUtils.getNumber(get(row, col("impact "+i)));
				if (impact1==0) continue;
				String type1 = get(row, col("impact "+i+" unit"));
				Output output1 = new Output(impact1, type1, null);
				output1.setPeriod(start, end);
				project.addOutput(output1);
			}
			
			project.put("ready", ready);
			project.put("isRep", isRep);
//			37	Wording for SoGive app		You funded XXXX hours/days/weeks of cancer research, well done!
			project.put("donationWording", get(row, col("wording")));
			
			ngo.addProject(project);
			
			UpdateRequestBuilder pi = client.prepareUpdate(SoGiveConfig.charityIndex, "charity", ourid);
//			String json = gson.toJson(ngo);		
			pi.setDoc(ngo);
			pi.setDocAsUpsert(true);
			ListenableFuture<ESHttpResponse> f = pi.execute();
			f.get().check();
			cnt++;
		}
		return cnt;
	}

	static final Map<String,Integer> cols = new HashMap();
	
	private int col(String colName) {
		String colname = StrUtils.toCanonical(colName);
		Integer ci = cols.get(colname);
		if (ci==null) {
			List<String> hs = Containers.filter(h -> h.equals(colname), HEADER_ROW);
			if (hs.isEmpty()) hs = Containers.filter(h -> h.contains(colname), HEADER_ROW);
			assert hs.size() == 1 : colname+" "+hs;
			ci = HEADER_ROW.indexOf(hs.get(0));
			cols.put(colname, ci);			
		}
		return ci;
	}

	private void init() {
		ESConfig config = new ESConfig();
		client = new ESHttpClient(config);
	}

	private void dumpFileHeader(CSVReader csvr) {
		String[] row1 = csvr.next();
		HEADER_ROW = Containers.apply(StrUtils::toCanonical, Arrays.asList(csvr.next()));
		String[] row3 = csvr.next();
		String[] row4 = csvr.next();		
		for(int i=0; i<100; i++) {
			String name = Containers.get(HEADER_ROW, i);
			String desc = Containers.get(row3, i);
			String eg = Containers.get(row4, i);
			if (Utils.isBlank(name)) continue;
			Printer.out(i+"\t"+name+"\t"+desc+"\t"+eg);			
		}
		
	}

	
}
