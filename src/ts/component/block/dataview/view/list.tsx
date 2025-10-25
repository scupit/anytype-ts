import React, { forwardRef, useEffect } from 'react';
import { observer } from 'mobx-react';
import { AutoSizer, WindowScroller, List, InfiniteLoader } from 'react-virtualized';
import { Icon, LoadMore } from 'Component';
import { I, S, U, translate } from 'Lib';
import Row from './list/row';

const HEIGHT = 32;

const ViewList = observer(forwardRef<I.ViewRef, I.ViewComponent>((props, ref) => {

	const { className, isPopup, isInline, getView, getSubId, onRecordAdd, getLimit, getEmptyView, getRecords, onRefRecord, loadData } = props;
	const view = getView();
	const records = getRecords();
	const subId = getSubId();
	const { offset, total } = S.Record.getMeta(subId, '');
	const limit = getLimit();
	const length = records.length;
	const isAllowedObject = props.isAllowedObject();
	const cn = [ 'viewContent', className ];

	useEffect(() => {
		U.Common.triggerResizeEditor(isPopup);

		const selection = S.Common.getRef('selectionProvider');
		const ids = selection?.get(I.SelectType.Record) || [];

		if (ids.length) {
			selection?.renderSelection();
		};
	});

	if (!length) {
		return getEmptyView(I.ViewType.List);
	};

	const loadMoreRows = ({ startIndex, stopIndex }) => {
		const subId = getSubId();
		const view = getView();

		let { offset } = S.Record.getMeta(subId, '');

		return new Promise((resolve, reject) => {
			offset += getLimit();
			loadData(view.id, offset, false, resolve);
			S.Record.metaSet(subId, '', { offset });
		});
	};

	let content = null;

	if (isInline) {
		content = (
			<div>
				{records.map((id: string, index: number) => (
					<Row
						ref={ref => onRefRecord(ref, id)}
						key={`grid-row-${view.id}index`}
						{...props}
						recordId={id}
						readonly={!isAllowedObject}
					/>
				))}
			</div>
		);
	} else {
		content = (
			<InfiniteLoader
				isRowLoaded={({ index }) => !!records[index]}
				loadMoreRows={loadMoreRows}
				rowCount={total}
				threshold={10}
			>
				{({ onRowsRendered }) => (
					<WindowScroller scrollElement={U.Common.getScrollContainer(isPopup).get(0)}>
						{({ height, isScrolling, scrollTop }) => (
							<AutoSizer disableHeight={true}>
								{({ width }) => (
									<List
										autoHeight={true}
										height={Number(height) || 0}
										width={Number(width) || 0}
										isScrolling={isScrolling}
										rowCount={records.length}
										rowHeight={HEIGHT}
										onRowsRendered={onRowsRendered}
										rowRenderer={({ key, index, style }) => (
											<div className="listItem" key={`grid-row-${view.id + index}`} style={style}>
												<Row
													ref={ref => onRefRecord(ref, records[index])}
													{...props} 
													recordId={records[index]}
													recordIdx={index}
												/>
											</div>
										)}
										scrollTop={scrollTop}
									/>
								)}
							</AutoSizer>
						)}
					</WindowScroller>
				)}
			</InfiniteLoader>
		);
	};

	return (
		<div className="wrap">
			<div id="scroll" className="scroll">
				<div id="scrollWrap" className="scrollWrap">
					<div className={cn.join(' ')}>
						{content}

						{isAllowedObject ? (
							<div className="row add">
								<div className="cell add">
									<div className="btn" onClick={e => onRecordAdd(e, 1)}>
										<Icon className="plus" />
										<div className="name">{translate('commonNewObject')}</div>
									</div>
								</div>
							</div>
						) : null}

						{isInline && (limit + offset < total) ? (
							<LoadMore limit={getLimit()} loaded={records.length} total={total} onClick={loadMoreRows} />
						) : ''}
					</div>
				</div>
			</div>
		</div>
	);

}));

export default ViewList;