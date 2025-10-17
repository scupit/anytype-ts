import { I, U } from 'Lib';
import { observable, intercept, makeObservable } from 'mobx';

class BlockContentWidget implements I.ContentWidget {
	
	layout: I.WidgetLayout = I.WidgetLayout.Link;
	limit = 0;
	viewId = '';
	autoAdded = false;
	section: I.WidgetSection = I.WidgetSection.Pin;

	constructor (props: I.ContentWidget) {
		this.layout = Number(props.layout) || I.WidgetLayout.Link;
		this.limit = Number(props.limit) || 0;
		this.viewId = String(props.viewId || '');
		this.autoAdded = Boolean(props.autoAdded);
		this.section = props.section || I.WidgetSection.Pin;

		makeObservable(this, {
			layout: observable,
			limit: observable,
			viewId: observable,
		});

		intercept(this as any, change => U.Common.intercept(this, change));
	};

};

export default BlockContentWidget;