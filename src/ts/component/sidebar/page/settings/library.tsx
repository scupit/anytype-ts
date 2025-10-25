import React, { forwardRef, useRef, useState, useEffect } from 'react';
import { observer } from 'mobx-react';
import { analytics, I, J, keyboard, S, Storage, translate, U } from 'Lib';
import { Button, Filter, Icon, IconObject, ObjectName } from 'Component';
import { AutoSizer, CellMeasurer, InfiniteLoader, List, CellMeasurerCache } from 'react-virtualized';

const LIMIT = 30;
const HEIGHT_ITEM = 28;
const HEIGHT_SECTION = 38;
const HEIGHT_SECTION_FIRST = 34;

const SidebarPageSettingsLibrary = observer(forwardRef<{}, I.SidebarPageComponent>((props, ref) => {

	const { page, isPopup } = props;
	const [ searchIds, setSearchIds ] = useState<string[]>(null);
	const pathname = U.Router.getRoute();
	const param = U.Router.getParam(pathname);
	const cache = useRef(new CellMeasurerCache({ fixedWidth: true, defaultHeight: HEIGHT_ITEM }));
	const filterInputRef = useRef(null);
	const timeoutRef = useRef(0);
	const canWrite = U.Space.canMyParticipantWrite();
	const sortId = useRef(I.SortId.LastUsed);
	const sortType = useRef(I.SortType.Desc);
	const savedRoute = useRef<any>({});
	const filter = useRef('');

	let type = '';
	let title = '';

	switch (page) {
		case 'settingsTypes': {
			type = I.ObjectContainerType.Type;
			title = U.Common.plural(10, translate('pluralObjectType'));
			break;
		};

		case 'settingsRelations': {
			type = I.ObjectContainerType.Relation;
			title = U.Common.plural(10, translate('pluralProperty'));
			break;
		};
	};

	const initSort = () => {
		const storage = storageGet();
		const sort = storage.sort[type];

		if (!sort) {
			const options = U.Menu.getLibrarySortOptions(sortId.current, sortType.current).filter(it => it.isSort);
			if (options.length) {
				sortId.current = options[0].id;
				sortType.current = options[0].defaultType;
			};
		};

		if (sort) {
			sortId.current = sort.id;
			sortType.current = sort.type;
		};
	};

	const load = (callBack?: (message: any) => void) => {
		const spaceview = U.Space.getSpaceview();
		const options = U.Menu.getLibrarySortOptions(sortId.current, sortType.current);
		const option = options.find(it => it.id == sortId.current);

		let sorts: I.Sort[] = [];
		let filters: I.Filter[] = [];

		if (option) {
			sorts.push({ relationKey: option.relationKey, type: sortType.current });
		} else {
			sorts = sorts.concat([
				{ relationKey: 'orderId', type: I.SortType.Asc, empty: I.EmptyType.End },
				{ 
					relationKey: 'uniqueKey', 
					type: I.SortType.Custom, 
					customOrder: U.Data.typeSortKeys(spaceview.isChat),
				},
				{ relationKey: 'name', type: I.SortType.Asc },
			]);
		};

		if (searchIds) {
			filters.push({ relationKey: 'id', condition: I.FilterCondition.In, value: searchIds || [] });
		};

		switch (type) {
			case I.ObjectContainerType.Type: {
				filters = filters.concat([
					{ relationKey: 'resolvedLayout', condition: I.FilterCondition.Equal, value: I.ObjectLayout.Type },
					{ relationKey: 'uniqueKey', condition: I.FilterCondition.NotIn, value: [ J.Constant.typeKey.type ] }
				]);
				break;
			};

			case I.ObjectContainerType.Relation: {
				filters.push({ relationKey: 'resolvedLayout', condition: I.FilterCondition.Equal, value: I.ObjectLayout.Relation });
				break;
			};
		};

		U.Subscription.subscribe({
			subId: J.Constant.subId.library,
			filters,
			sorts,
			keys: J.Relation.default.concat([ 'lastUsedDate', 'sourceObject' ]),
			noDeps: true,
			ignoreHidden: true,
			ignoreDeleted: true,
		}, callBack);
	};

	const loadSearchIds = (clear: boolean) => {
		if (filter.current) {
			U.Subscription.search({
				filters: [],
				sorts: [],
				fullText: filter.current,
				keys: [ 'id' ],
			}, (message: any) => {
				setSearchIds((message.records || []).map(it => it.id));
			});
		} else {
			setSearchIds(null);
		};
	};

	const getSections = () => {
		const records = S.Record.getRecords(J.Constant.subId.library);

		let myLabel = '';
		let systemLabel = '';

		switch (type) {
			case I.ObjectContainerType.Type: {
				myLabel = translate('commonMyTypes');
				systemLabel = translate('commonSystemTypes');
				break;
			};	

			case I.ObjectContainerType.Relation: {
				myLabel = translate('commonMyRelations');
				systemLabel = translate('commonSystemRelations');
				break;
			};
		};

		return [
			{
				id: 'my', name: myLabel,
				children: records.filter(it => S.Block.isAllowed(it.restrictions, [ I.RestrictionObject.Delete ])),
			},
			{
				id: 'system', name: systemLabel,
				children: records.filter(it => !S.Block.isAllowed(it.restrictions, [ I.RestrictionObject.Delete ])),
			},
		].filter(it => it.children.length);
	};

	const getItems = () => {
		const sections = getSections();

		let items: any[] = [];

		sections.forEach((section, idx) => {
			if (section.name) {
				const item: any = { id: section.id, name: section.name, isSection: true };

				if (idx == 0) {
					item.isFirst = true;
				};

				items.push(item);
			};

			items = items.concat(section.children || []);
		});

		return items;
	};

	const getRowHeight = (item: any) => {
		if (item.isSection) {
			return item.isFirst ? HEIGHT_SECTION_FIRST : HEIGHT_SECTION;
		};
		return HEIGHT_ITEM;
	};

	const onFilterChange = (v: string) => {
		window.clearTimeout(timeoutRef.current);
		timeoutRef.current = window.setTimeout(() => {
			if (filter.current != v) {
				filter.current = v;
				loadSearchIds(true);
			};
		}, J.Constant.delay.keyboard);
	};

	const onFilterClear = () => {
		setSearchIds(null);
		analytics.event('SearchInput', { route: analytics.route.settings });
	};

	const onMore = (e) => {
		e.stopPropagation();

		const options = U.Menu.getLibrarySortOptions(sortId.current, sortType.current);

		let menuContext = null;

		S.Menu.open('select', {
			element: '.containerSettings #button-object-more',
			horizontal: I.MenuDirection.Right,
			offsetY: 4,
			className: 'fixed',
			classNameWrap: 'fromSidebar',
			onOpen: context => menuContext = context,
			data: {
				options,
				noClose: true,
				onSelect: (e: any, item: any) => {
					const storage = storageGet();

					sortId.current = item.id;
					sortType.current = item.type;

					storage.sort[type] = { id: item.id, type: item.type };
					analytics.event('ChangeLibrarySort', { type: item.id, sort: I.SortType[item.type] });

					storageSet(storage);
					initSort();
					load();

					menuContext.ref.updateOptions(U.Menu.getLibrarySortOptions(sortId.current, sortType.current));
				},
			}
		});
	};

	const onClick = (item: any) => {
		const param = {
			layout: I.ObjectLayout.Settings,
			id: U.Object.actionByLayout(item.layout),
			_routeParam_: {
				additional: [
					{ key: 'objectId', value: item.id }
				],
			},
		};

		U.Object.openRoute(param);

		let e = '';

		switch (item.layout) {
			case I.ObjectLayout.Type: e = 'ClickSettingsSpaceType'; break;
			case I.ObjectLayout.Relation: e = 'ClickSettingsSpaceRelation'; break;
		};

		analytics.event(e, { route: analytics.route.library });
	};

	const onContext = (item: any) => {
		const { x, y } = keyboard.mouse.page;
		const menuParam = {
			className: 'fixed',
			classNameWrap: 'fromSidebar',
			element: `.containerSettings #item-${item.id}`,
			rect: { width: 0, height: 0, x: x + 4, y },
			data: {},
		};

		let menuId = '';

		switch (item.layout) {
			case I.ObjectLayout.Type: {
				menuId = 'objectContext';
				menuParam.data = Object.assign(menuParam.data, {
					objectIds: [ item.id ],
					subId: J.Constant.subId.library,
					route: analytics.route.library,
				});
				break;
			};

			case I.ObjectLayout.Relation: {
				menuId = 'blockRelationEdit';
				menuParam.data = Object.assign(menuParam.data, {
					rootId: item.id,
					filter: filter,
					relationId: item.id,
					route: analytics.route.settingsSpace,
					noUnlink: true,
				});
				break;
			};
		};

		S.Menu.closeAll(null, () => {
			S.Menu.open(menuId, menuParam);
		});
	};

	const onAdd = (e) => {
		e.preventDefault();
		e.stopPropagation();

		switch (type) {
			case I.ObjectContainerType.Type: {
				U.Object.createType({ name: filter }, isPopup);
				break;
			};

			case I.ObjectContainerType.Relation: {
				const node = $('.containerSettings');
				const width = node.width() - 32;

				S.Menu.open('blockRelationEdit', {
					element: `.containerSettings #button-object-create`,
					offsetY: 4,
					width,
					className: 'fixed',
					classNameWrap: 'fromSidebar',
					horizontal: I.MenuDirection.Right,
					data: {
						filter: filter,
						addCommand: (rootId: string, blockId: string, relation: any, onChange: (message: any) => void) => {
							if (relation.id && filter && searchIds) {
								setSearchIds(searchIds.concat(relation.id));
							};
						},
						route: analytics.route.settingsSpace,
					},
				});
				break;
			};
		};

		analytics.event(`ScreenCreate${getAnalyticsSuffix()}`, { route: 'SettingsSpace' });
	};

	const storageGet = () => {
		const storage = Storage.get('settingsLibrary') || {};
		storage.sort = storage.sort || {};
		return storage;
	};

	const storageSet = (obj: any) => {
		Storage.set('settingsLibrary', obj);
	};

	const getAnalyticsSuffix = () => {
		const map = {
			[I.ObjectContainerType.Type]: 'Type',
			[I.ObjectContainerType.Relation]: 'Relation',
		};
		return map[type];
	};

	const openFirst = () => {
		const pathname = U.Router.getRoute();
		const param = U.Router.getParam(pathname);
		const records = getSections().reduce((acc, el) => acc.concat(el.children), []);

		if (records.find(it => it.id == param?.objectId) || !records.length) {
			return;
		};

		onClick(records[0]);
	};

	const ItemSection = (item: any) => {
		const cn = [ 'itemSection' ];

		if (item.isFirst) {
			cn.push('isFirst');
		};

		return (
			<div className={cn.join(' ')}>
				<div className="name">{item.name}</div>
			</div>
		);
	};

	const Item = (item: any) => {
		if (item.isSection) {
			return <ItemSection {...item} />;
		};

		const cn = [ 'item' ];
		if (item.id == param?.objectId) {
			cn.push('active');
		};

		return (
			<div
				id={`item-${item.id}`}
				className={cn.join(' ')}
				onClick={() => onClick(item)}
				onContextMenu={() => onContext(item)}
			>
				<IconObject object={item} />
				<ObjectName object={item} />
			</div>
		);
	};

	const rowRenderer = ({ index, key, parent, style }) => (
		<CellMeasurer
			key={key}
			parent={parent}
			cache={cache.current}
			columnIndex={0}
			rowIndex={index}
		>
			<div className="row" style={style}>
				<Item {...items[index]} />
			</div>
		</CellMeasurer>
	);

	const items = getItems();

	useEffect(() => {
		savedRoute.current = U.Common.objectCopy(keyboard.getMatch(false));
		filterInputRef.current?.focus();

		initSort();
		load(openFirst);

		return () => {
			U.Subscription.destroyList([ J.Constant.subId.library ]);
			U.Router.go(`/${U.Router.build(savedRoute.current.params)}`, {});
		};
	}, []);

	useEffect(() => {
		load();
	}, [ searchIds ]);

	return (
		<>
			<div className="subHead">
				<div className="side left">
					<Icon className="back" onClick={() => S.Common.setLeftSidebarState('vault', 'settingsSpace')} />
				</div>
				<div className="side center">
					<div className="name">{title}</div>
				</div>
				<div className="side right">
					<Icon id="button-object-more" className="more" onClick={onMore} />
				</div>
			</div>

			<div id="body" className="body">
				<div className="list">
					<div className="filterWrapper">
						<div className="side left">
							<Filter
								ref={filterInputRef}
								icon="search"
								className="outlined"
								placeholder={translate('commonSearch')}
								onChange={onFilterChange}
								onClear={onFilterClear}
							/>
						</div>
						<div className="side right">
							{canWrite ? <Button id="button-object-create" color="blank" className="c28" text={translate('commonNew')} onClick={onAdd} /> : ''}
						</div>
					</div>

					{items.length ? (
						<div className="inner">
							<InfiniteLoader
								rowCount={items.length}
								loadMoreRows={() => {}}
								isRowLoaded={() => true}
								threshold={LIMIT}
							>
								{({ onRowsRendered }) => (
									<AutoSizer className="scrollArea">
										{({ width, height }) => (
											<List
												width={width}
												height={height}
												deferredMeasurmentCache={cache.current}
												rowCount={items.length}
												rowHeight={({ index }) => getRowHeight(items[index])}
												rowRenderer={rowRenderer}
												onRowsRendered={onRowsRendered}
												overscanRowCount={10}
												scrollToAlignment="center"
											/>
										)}
									</AutoSizer>
								)}
							</InfiniteLoader>
						</div>
					) : ''}
				</div>
			</div>
		</>
	);

}));

export default SidebarPageSettingsLibrary;