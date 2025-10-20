import React, { forwardRef, useRef, useEffect, useState, useImperativeHandle, DragEvent } from 'react';
import $ from 'jquery';
import raf from 'raf';
import { observer } from 'mobx-react';
import { I, U, J, S, keyboard, sidebar } from 'Lib';

import PageType from './page/type';
import PageObjectRelation from './page/object/relation';
import PageObjectTableOfContents from './page/object/tableOfContents';
import PageWidget from './page/widget';

interface Props {
	isPopup?: boolean;
};

interface SidebarRightRefProps {
	getNode: () => HTMLElement | null;
	setState: (state: I.SidebarRightState) => void;
	getState: () => I.SidebarRightState;
};

const Components = {
	type:					 PageType,
	objectRelation:			 PageObjectRelation,
	objectTableOfContents:	 PageObjectTableOfContents,
	widget:					 PageWidget,
};

const SidebarRight = observer(forwardRef<SidebarRightRefProps, Props>((props, ref) => {
	
	const { isPopup } = props;
	const nodeRef = useRef(null);
	const pageRef = useRef(null);
	const spaceview = U.Space.getSpaceview();
	const rightSidebar = S.Common.getRightSidebarState(isPopup);
	const [ state, setState ] = useState<I.SidebarRightState>({
		rootId: '',
		details: {},
		readonly: false,
		noPreview: false,
		previous: null,
		blockId: '',
		back: '',
	});

	const page = String(rightSidebar.page || '');
	const id = U.Common.toCamelCase(page.replace(/\//g, '-'));
	const Component = Components[id];
	const pageId = U.Common.toCamelCase(`sidebarPage-${id}`);
	const cn = [ 'sidebar', 'right', `space${I.SpaceUxType[spaceview.uxType]}` ];
	const cnp = [ 'sidebarPage', U.Common.toCamelCase(`page-${page.replace(/\//g, '-')}`) ];
	const withPreview = !state.noPreview && [ 'type' ].includes(page);
	const ox = useRef(0);
	const oy = useRef(0);
	const sx = useRef(0);
	const frame = useRef(0);
	const width = useRef(0);

	if (withPreview) {
		cn.push('withPreview');
	};

	if (!U.Common.isPlatformMac()) {
		cn.push('customScrollbar');
	};

	const onResizeStart = (e: DragEvent) => {
		e.preventDefault();
		e.stopPropagation();

		const win = $(window);
		const body = $('body');
		const node = $(nodeRef.current);
		const o = node.offset();
		const data = sidebar.getData(I.SidebarPanel.Right);

		ox.current = o.left;
		oy.current = o.top;
		sx.current = e.pageX;
		width.current = node.outerWidth();

		keyboard.disableSelection(true);
		keyboard.setResize(true);
		body.addClass('colResize');

		win.off('mousemove.sidebar mouseup.sidebar blur.sidebar');
		win.on('mousemove.sidebar', e => onResizeMove(e));
		win.on('mouseup.sidebar blur.sidebar', e => onResizeEnd());
	};

	const onResizeMove = (e: any) => {
		if (frame.current) {
			raf.cancel(frame.current);
		};

		frame.current = raf(() => {
			if (sidebar.isAnimating) {
				return;
			};

			const w = width.current + ox.current - e.pageX;
			const d = w - width.current;

			if (d) {
				sidebar.setWidth(I.SidebarPanel.Right, isPopup, w);

				if (pageRef.current && pageRef.current.resize) {
					pageRef.current.resize();
				};
			};
		});
	};

	const onResizeEnd = () => {
		keyboard.disableSelection(false);
		keyboard.setResize(false);
		raf.cancel(frame.current);

		$('body').removeClass('colResize');
		$(window).off('mousemove.sidebar mouseup.sidebar');
	};

	useEffect(() => {
		pageRef.current?.forceUpdate();
	});

	useImperativeHandle(ref, () => ({
		getNode: () => nodeRef.current,
		getState: () => U.Common.objectCopy(state),
		setState: (newState: I.SidebarRightState) => {
			if (newState.page !== state.page) {
				delete(state.previous);
				newState.previous = U.Common.objectCopy(state);
			};

			setState(newState);
		},
	}));

	return (
		<div 
			id="sidebarRight"
			ref={nodeRef}
			className={cn.join(' ')}
		>
			{Component ? (
				<div id={pageId} className={cnp.join(' ')}>
					<Component 
						ref={pageRef} 
						{...props} 
						{...state}
						sidebarDirection={I.SidebarDirection.Right}
						getId={() => pageId}
					/> 
				</div>
			): ''}

			<div className="resize-h" draggable={true} onDragStart={onResizeStart}>
				<div className="resize-handle" />
			</div>
		</div>
	);

}));

export default SidebarRight;