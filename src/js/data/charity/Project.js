/** Data model functions for the NGO data-type */

import _ from 'lodash';
import DataClass from '../../base/data/DataClass';
import Money from '../../base/data/Money';

/**
 * See also Project.java
 */
class Project extends DataClass {

	inputs = [
		{"@type":"Money","name":"annualCosts","currency":"GBP"},
		{"@type":"Money","name":"tradingCosts","currency":"GBP"},
		{"@type":"Money","name":"incomeFromBeneficiaries","currency":"GBP"}
	];
	outputs = []; //default

	constructor(base) {
		super(base);
		Object.assign(this, base);
		// ensure year is the right type
		if (this.year) {
			this.year = parseInt(this.year);
		}
	}
}
DataClass.register(Project, "Project");
const This = Project;
export default Project;

Project.overall = 'overall';

Project.year = (ngo) => This.assIsa(ngo, Project.type) && ngo.year;

Project.isOverall = (project) => Project.assIsa(project) && project.name && project.name.toLowerCase() === Project.overall;

/**
 * 
 @return {Output[]} never null, can be empty
 */
Project.outputs = project => {
	Project.assIsa(project);	
	Project.safeList(project, 'outputs');
	return project.outputs;
};
/** 
 * @return {Money[]} never null, can be empty
 */
Project.inputs = project => {
	Project.checkIsa(project);
	Project.safeList(project, 'inputs');
	return project.inputs;
};

Project.getLatest = (projects) => {
	if ( ! projects) return null;
	const psorted = _.sortBy(projects, Project.year);
	return psorted[psorted.length - 1];
};

/**
 * Find the projectCosts input
 * 
 * NB: WAS projectCosts or annualCosts -- changed Sept 2021 ^Dan
 * @returns {Money}
 */
Project.getCost = (project) => {
	Project.assIsa(project);
	let inputs = Project.inputs(project);
	let costs = inputs.filter(input => input.name==='projectCosts');
	return costs[0]; // can be null
};

/**
 * Actually, this is "get the total cost minus certain categories, so its more like total costs covered by donations"
 * @param {!Project} project
 * @returns {!Money}
 */
Project.getTotalCost = (project) => {
	// total - but some inputs are actually negatives
	const inputs = Project.inputs(project);
	const currency = inputs.reduce((curr, input) => curr || input.currency, null);
	const value = inputs.reduce((total, input) => {	
		if (deductibleInputs.indexOf(input.name) !== -1) {
			// These count against the total
			// NB: Use abs in case an overly smart editor put them in as -ives
			return total - Math.abs(input.value || 0);
		}
		return total + (Money.value(input) || 0); // normal
	}, 0);
	return new Money({currency, value});
};

// Re tradingCosts (e.g. spending on charity shops) -- these are expected to generate income at the same or higher level,
// which is why we deduct them.
// E.g. if British Heart Foundation spend £100m, but £25m is on their charity shops -- then £75m was on charity.
// And we assume (as a 1st approximation) that that £25m was neutral: Your donation will not go to fund charity shops, 'cos they
// generate income.
const deductibleInputs = ['incomeFromBeneficiaries', 'tradingCosts'];
