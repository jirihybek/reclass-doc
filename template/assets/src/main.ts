/**
 * Reclass doc generator
 *
 * @author Jiri Hybek <jiri@hybek.cz>
 * @license Apache-2.0 (c) 2017 Jiri Hybek
 */

import {buildSearchIndex, search} from './search';

let bindToggleDetails = (parent: HTMLElement = document.body) => {

	let bind = (el: HTMLElement) => {

		el.addEventListener("click", () => {

			el.parentElement.classList.toggle('show-details');

		});

	};

	let items = parent.querySelectorAll(".toggle-details");

	for(let i = 0; i < items.length; i++)
		bind(<HTMLElement> items.item(i));

};

let bindCollapseButtons = (parent: HTMLElement = document.body) => {

	let bind = (el: HTMLElement) => {

		el.addEventListener("click", (ev) => {

			ev.stopPropagation();

			el.parentElement.parentElement.parentElement.classList.toggle('collapsed');

		});

	};

	let items = parent.querySelectorAll(".collapse");

	for(let i = 0; i < items.length; i++)
		bind(<HTMLElement> items.item(i));

};

let bindToggleInheritedProps = (parent: HTMLElement = document.body) => {

	let bind = (el: HTMLInputElement) => {

		let update = () => {

			if(el.checked)
				el.parentElement.parentElement.parentElement.parentElement.classList.add('inherited-props');
			else
				el.parentElement.parentElement.parentElement.parentElement.classList.remove('inherited-props');

			localStorage['reclass-doc-inherited'] = el.checked ? 1 : 0;

		};

		el.addEventListener("change", (ev) => {

			ev.stopPropagation();

			update();

		});

		if(localStorage['reclass-doc-inherited'] == 1)
			el.checked = true;

		update();

	};

	let items = parent.querySelectorAll(".toggle-inherited-props");

	for(let i = 0; i < items.length; i++)
		bind(<HTMLInputElement> items.item(i));

};

let bindSearch = (parent: HTMLElement = document.body) => {

	let bind = (el: HTMLInputElement) => {

		if((<any>el)._searchBound) return;
		(<any>el)._searchBound = true;

		let itemContainer = parent.querySelector( el.getAttribute('data-search-container') );

		if(!itemContainer){
			console.warn("Search container '" + el.getAttribute('data-search-container') + "' not found.");
			return;
		}

		let index = buildSearchIndex(<HTMLElement> itemContainer, el.getAttribute('data-search-item'));

		let _search = (term: string) => {

			search(index, term);

			if(term.length > 0 && !itemContainer.classList.contains('search-active'))
				itemContainer.classList.add('search-active');
			else if(term.length === 0 && itemContainer.classList.contains('search-active'))
				itemContainer.classList.remove('search-active');

			if(el.getAttribute('data-search-session') == 'true')
				localStorage['reclass-doc-search'] = term;

			localStorage['reclass-doc-search-' + el.id] = term;

		};

		el.addEventListener("input", (ev) => {

			let term = el.value.trim();

			_search(term);

		});

		//Restore search value
		if(el.getAttribute('data-search-session') == 'true' && localStorage['reclass-doc-search']){
			
			el.value = localStorage['reclass-doc-search'];
			_search(localStorage['reclass-doc-search']);

		} else if(localStorage['reclass-doc-loc'] == location.href && localStorage['reclass-doc-search-' + el.id]) {
			
			el.value = localStorage['reclass-doc-search-' + el.id];
			_search(localStorage['reclass-doc-search-' + el.id]);

		} else {
			
			_search('');

		}

	};

	let items = parent.querySelectorAll(".search-box[data-search-container][data-search-item]");

	for(let i = 0; i < items.length; i++)
		bind(<HTMLInputElement> items.item(i));

};

let watchChanges = () => {

	let lastMod = null;

	let reload = () => {

		localStorage['reclass-doc-scroll'] = document.body.scrollTop;

		location.reload();

	};

	let check = () => {

		let xhrReq = new XMLHttpRequest();

		//Bind handler
		xhrReq.addEventListener("load", () => {

			if(lastMod === null)
				lastMod = xhrReq.responseText;
			else if(lastMod != xhrReq.responseText)
				reload();

		});

		xhrReq.addEventListener("error", (err) => {
			
			console.error(err);

		});

		xhrReq.open("GET", "/_modified");
		xhrReq.send();

	};

	setInterval(check, 3000);

	if(localStorage['reclass-doc-scroll']){
		document.body.scrollTop = localStorage['reclass-doc-scroll'];
		localStorage['reclass-doc-scroll'] = null;
	}

};

window.addEventListener("load", () => {

	bindToggleDetails();
	bindCollapseButtons();
	bindToggleInheritedProps();
	bindSearch();

	setTimeout(() => {
		localStorage['reclass-doc-loc'] = location.href;
	}, 500);

});

let w: any = window;

//Export to window
w.__bindSearch = bindSearch;
w.__watchChanges = watchChanges;