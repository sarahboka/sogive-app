import React from "react";
import { toTitleCase } from "../base/utils/miscutils";

const Banner = ({title}) => {

	return (
			<div className="gradient-banner">
					<div className="worldImage d-flex justify-content-center align-items-center">
							<h1>{title}</h1>
					</div>
			</div>
	);
};

const TextBanner = ({page, title, subtitle, image}) => {

	return (
		<div id="text-banner" className="bg-light">
			<div className="container py-5">
			<div className="row">
				<div className="col-md">
					<p>{page}</p>
					<h3>{title}</h3>
					<p>{subtitle}</p>
					<a className="btn btn-primary mb-5" href="#about">Inquire now</a>
				</div>
				<div className="col-md">
					<img src={image} alt="" className="w-100" />
				</div>
			</div>
			</div>
		</div>
	)
}

const NewsletterCard = () => {
	return (
		<div id="newsletter-card" className="bg-light">
			<div className="container py-5">
				<div className="row">
						<div className="col-md">
								<h3>Subscribe to our newsletter</h3>
								<p>We send a monthly newsletter with our commentary on the latest news in the charity sector, as well as updates on our new analyses. Sign up here.</p>
						</div>
						<form id='mailing-list' action='https://profiler.good-loop.com/form/sogive.org' class='col-md'>
							<label class=''>Your email address</label>
							<div className="email-input row">
								<div className="col pr-0">
									<input class='form-control w-100 h-100' type='email' name='email' placeholder='Your Email' />
								</div>
								<div className="col pl-0">
									<button class="btn btn-primary" type='submit'>Sign up</button>
								</div>
							</div>
						</form>
				</div>
			</div>
		</div>
	); 
};

const ImpactRatingCard = ({title}) => {

	return (
		<div id="impact-rating-card" className="">
			<div className="container py-5">
				<div className="row">
						<div className="col-md-6">
								<h3>{title}</h3>
								<a href="#" className="btn btn-primary mt-3">Explore impact ratings</a>
						</div>
						<div className="col-md-6">
								<p className="press-caption text-center">SoGive in the press</p>
								<div className="row">
										<div className="col"><a href="#"><img src="/img/logo/The-Scotsman-logo.jpg" alt="The Scotsman" className="w-100" /></a></div>
										<div className="col"><a href="#"><img src="/img/logo/TEDxCourtauld-logo.jpg" alt="TED" className="w-100" /></a></div>
								</div>
						</div>
				</div>
			</div>
		</div>
	);
};

const ContactForm = () => {

	return (<>
		<form id='contact-card' action='https://profiler.good-loop.com/form/sogive.org' class=''>

			<div className="contact-info row">
				<div className="col d-flex flex-column">
					<label>Your name</label>
					<input type="text" id="name" />
				</div>
				<div className="col d-flex flex-column">
					<label>Your email</label>
					<input type="email" id="email" />
				</div>
			</div>
			<div className="contact-message row">
				<div className="col d-flex flex-column">
					<label>Your message</label>
					<input className="p-5" type="text"id="message" />
				</div>
			</div>
			<button class="btn btn-primary mt-1" type='submit'>Sumbit</button>
		</form>
	</>)
}


const MethodCard = () => {
	return (
			<div id="method-card" className="">
					<div className="container py-5">
							<h2>Our Methodology</h2>
							<div className="row method-4-steps">
									<div className="col-md">
											<img src="/img/homepage/1-analyse.png" alt="" className="w-100" />
											<p>1. Analyse financial statements</p>
											<p>We review charities' financial and program spending.</p>
									</div>
									<div className="col-md">
											<img src="/img/homepage/2-assess.png" alt="" className="w-100" />
											<p>2. Assess outcomes</p>
											<p>We determine what the charity achieved for each program in measurable units.</p>
									</div>
									<div className="col-md">
											<img src="/img/homepage/3-calculate.png" alt="" className="w-100" />
											<p>3. Calculate cost-effectiveness</p>
											<p>We divide the costs by the outcomes achieved to get the cost per outcome.</p>
									</div>
									<div className="col-md">
											<img src="/img/homepage/4-compare.png" alt="" className="w-100" />
											<p>4. Compare to others</p>
											<p>We compare the cost per outcomes with other charities to find the most effective ones.</p>
									</div>
							</div>
							<div className="text-center">
									<h4>Read more about our methodology</h4>
									<a href="#methodology" className="btn btn-white">Learn more</a>
							</div>
					</div>
			</div>
	);
};

const ContactCardLight = ({title}) => {

	return (
	<div id="contact-card">
		<div className="bg-light">
			<div className="container py-5">
				<div className="row">
					<div className="col-md">
						<h3>{title}</h3>
						<p>Want to learn more about how SoGive can help you as a financial adviser? Contact us using the form and we'll get in touch with you to help.</p>
						<div className="row mb-5">
							<div className="col-3 col-md-2">
								<img src="/img/profilepic/sanjay.png" alt="" className="w-100" />
							</div>
							<div className="col-3 col-md-2">
								<img src="/img/profilepic/daniel.png" alt="" className="w-100" />
							</div>
						</div>
					</div>
					<div className="col-md">
						<ContactForm />
					</div>
				</div>
			</div>
		</div>
	</div>
	);
};

export {
  ContactForm,
	NewsletterCard,
	ImpactRatingCard,
	Banner,
	TextBanner,
	MethodCard,
	ContactCardLight,
};