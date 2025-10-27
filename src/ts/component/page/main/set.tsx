import React, { forwardRef, useEffect, useState, useRef, useImperativeHandle } from 'react';
import $ from 'jquery';
import raf from 'raf';
import { observer } from 'mobx-react';
import { Header, Footer, Loader, Block, Deleted, HeadSimple, EditorControls } from 'Component';
import { I, M, C, S, U, J, Action, keyboard, Dataview, analytics, sidebar, Onboarding } from 'Lib';

const PageMainSet = observer(forwardRef<I.PageRef, I.PageComponent>((props, ref) => {

	const [ isLoading, setIsLoading ] = useState(false);
	const [ isDeleted, setIsDeleted ] = useState(false);
	const { isPopup } = props;
	const nodeRef = useRef(null);
	const headerRef = useRef(null);
	const headRef = useRef(null);
	const controlsRef = useRef(null);
	const blockRefs = useRef<any>({});
	const rootId = keyboard.getRootId(isPopup);
	const check = U.Data.checkDetails(rootId, rootId, [ 'layout' ]);
	const idRef = useRef('');

	const unbind = () => {
		const ns = U.Common.getEventNamespace(isPopup);
		const events = [ 'keydown', 'scroll' ];

		$(window).off(events.map(it => `${it}.set${ns}`).join(' '));
	};

	const rebind = () => {
		const win = $(window);
		const ns = U.Common.getEventNamespace(isPopup);
		const container = U.Common.getScrollContainer(isPopup);

		unbind();

		win.on(`keydown.set${ns}`, e => onKeyDown(e));
		container.on(`scroll.set${ns}`, () => onScroll());
	};

	const checkDeleted = (): boolean => {
		if (isDeleted) {
			return true;
		};

		const object = S.Detail.get(rootId, rootId, []);

		if (object.isDeleted) {
			setIsDeleted(true);
			return true;
		};

		return false;
	};

	const open = () => {
		if (idRef.current == rootId) {
			return;
		};

		close();
		idRef.current = rootId;
		setIsDeleted(false);
		setIsLoading(true);

		C.ObjectOpen(rootId, '', U.Router.getRouteSpaceId(), (message: any) => {
			setIsLoading(false);

			if (!U.Common.checkErrorOnOpen(rootId, message.error.code, this)) {
				return;
			};

			const object = S.Detail.get(rootId, rootId, []);
			if (checkDeleted()) {
				return;
			};

			headRef.current?.forceUpdate();
			headRef.current?.forceUpdate();
			controlsRef.current?.forceUpdate();

			sidebar.rightPanelSetState(isPopup, { rootId });
			resize();

			if (U.Object.isTypeLayout(object.layout)) {
				window.setTimeout(() => Onboarding.start('typeResetLayout', isPopup), 50);

				analytics.event('ScreenType', { objectType: object.id });
			};
		});
	};

	const close = () => {
		const id = idRef.current;
		if (!id) {
			return;
		};

		const { isPopup, matchPopup } = props;
		const close = !isPopup || (isPopup && (matchPopup?.params?.id != id));

		if (close) {
			Action.pageClose(id, true);
		};
	};

	const onScroll = () => {
		if (!isPopup && keyboard.isPopup()) {
			return;
		};

		S.Common.getRef('selectionProvider')?.renderSelection();
	};

	const onKeyDown = (e: any) => {
		if (!isPopup && keyboard.isPopup()) {
			return;
		};

		const selection = S.Common.getRef('selectionProvider');
		const ids = selection?.get(I.SelectType.Record) || [];
		const count = ids.length;
		const ref = blockRefs[J.Constant.blockId.dataview];

		keyboard.shortcut('searchText', e, () => {
			e.preventDefault();

			$(controlsRef.current).find('.filter .icon.search').trigger('click');
		});

		keyboard.shortcut('createObject', e, () => {
			e.preventDefault();

			const { ww, wh } = U.Common.getWindowDimensions();

			ref?.ref?.onRecordAdd(e, -1, '', {
				horizontal: I.MenuDirection.Center,
				vertical: I.MenuDirection.Center,
				rect: { x: ww / 2, y: wh / 2, width: 0, height: 0 },
			});
		});

		if (!keyboard.isFocused) {
			keyboard.shortcut('selectAll', e, () => {
				e.preventDefault();

				const records = S.Record.getRecordIds(S.Record.getSubId(rootId, J.Constant.blockId.dataview), '');
				selection.set(I.SelectType.Record, records);

				$(window).trigger('selectionSet');
			});

			if (count && !S.Menu.isOpen()) {
				keyboard.shortcut('backspace, delete', e, () => {
					e.preventDefault();
					Action.archive(ids, analytics.route.set);
					selection.clear();
				});
			};
		};

		// History
		keyboard.shortcut('history', e, () => {
			e.preventDefault();
			U.Object.openAuto({ layout: I.ObjectLayout.History, id: rootId });
		});
	};

	const isReadonly = () => {
		const root = S.Block.getLeaf(rootId, rootId);

		if (root && root.isLocked()) {
			return true;			
		};

		const object = S.Detail.get(rootId, rootId, [ 'isArchived' ], true);
		if (object.isArchived) {
			return true;
		};

		return !U.Space.canMyParticipantWrite();
	};

	const resize = () => {
		if (isLoading) {
			return;
		};

		raf(() => {
			const node = $(nodeRef.current);
			const cover = node.find('.block.blockCover');
			const container = U.Common.getPageContainer(isPopup);
			const header = container.find('#header');
			const hh = isPopup ? header.height() : J.Size.header;

			if (cover.length) {
				cover.css({ top: hh });
			};
		});
	};

	let content = null;
	if (isDeleted) {
		content = <Deleted {...props} />;
	} else
	if (isLoading) {
		content = <Loader id="loader" fitToContainer={true} isPopup={isPopup} />;
	} else {
		const children = S.Block.getChildren(rootId, rootId, it => it.isDataview());
		const cover = new M.Block({ id: `${rootId}-cover`, type: I.BlockType.Cover, childrenIds: [], fields: {}, content: {} });
		const readonly = isReadonly();
		const placeholder = Dataview.namePlaceholder(check.layout);

		content = (
			<>
				{check.withCover ? <Block {...props} key={cover.id} rootId={rootId} block={cover} readonly={readonly} /> : ''}

				<div className="blocks wrapper">
					<EditorControls 
						ref={controlsRef} 
						key="editorControls" 
						{...props} 
						rootId={rootId} 
						resize={resize} 
						readonly={readonly}
					/>

					<HeadSimple 
						{...props} 
						ref={headRef} 
						placeholder={placeholder} 
						rootId={rootId} 
						readonly={readonly}
					/>

					{children.map((block: I.Block, i: number) => (
						<Block
							{...props}
							ref={ref => blockRefs.current[block.id] = ref}
							key={block.id}
							rootId={rootId}
							iconSize={20}
							block={block}
							className="noPlus"
							isSelectionDisabled={true}
							readonly={readonly}
						/>
					))}
				</div>
			</>
		);
	};

	useEffect(() => {
		open();
		rebind();

		return () => {
			close();
			unbind();
		};
	}, []);

	useEffect(() => {
		open();
		resize();
		checkDeleted();
	});

	useImperativeHandle(ref, () => ({
		resize,
	}));

	return (
		<div ref={nodeRef}>
			<Header 
				{...props} 
				component="mainObject" 
				ref={headerRef} 
				rootId={rootId} 
			/>

			<div id="bodyWrapper" className="wrapper">
				<div className={[ 'editorWrapper', check.className ].join(' ')}>
					{content}
				</div>
			</div>

			<Footer component="mainObject" {...props} />
		</div>
	);

}));

export default PageMainSet;