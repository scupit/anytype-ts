import React, { forwardRef, useRef, useEffect } from 'react';
import { observer } from 'mobx-react';
import { Title, Label, Icon, Button, IconObject, ObjectName } from 'Component';
import { I, C, S, U, translate, Action, analytics, } from 'Lib';
import { AutoSizer, WindowScroller, CellMeasurer, CellMeasurerCache, List } from 'react-virtualized';

interface Props extends I.PageSettingsComponent {
	onStopSharing: () => void;
};

const HEIGHT = 64;

const Members = observer(forwardRef<I.PageRef, Props>((props, ref) => {

	const { isPopup, onStopSharing } = props;
	const { space } = S.Common;
	const { membership } = S.Auth;
	const spaceview = U.Space.getSpaceview();
	const participant = U.Space.getParticipant();
	const nodeRef = useRef(null);
	const listRef = useRef(null);
	const topRef = useRef(0);
	const isOwner = U.Space.isMyOwner();
	const cache = useRef(new CellMeasurerCache({ fixedWidth: true, defaultHeight: HEIGHT }));

	const onScroll = ({ scrollTop }) => {
		if (scrollTop) {
			topRef.current = scrollTop;
		};
	};

	const onUpgrade = (type: string) => {
		Action.membershipUpgrade({ type, route: analytics.route.settingsSpaceShare });
	};

	const getParticipantList = () => {
		const statuses = [ I.ParticipantStatus.Active ];

		if (isOwner) {
			statuses.push(I.ParticipantStatus.Joining);
		};

		return U.Space.getParticipantsList(statuses).sort((c1, c2) => {
			const isOwner1 = c1.permissions == I.ParticipantPermissions.Owner;
			const isOwner2 = c2.permissions == I.ParticipantPermissions.Owner;
			const isRequest1 = c1.isJoining;
			const isRequest2 = c2.isJoining;

			if (isOwner1 && !isOwner2) return -1;
			if (!isOwner1 && isOwner2) return 1;
			if (isRequest1 && !isRequest2) return -1;
			if (!isRequest1 && isRequest2) return 1;
			if (isRequest1 && isRequest2) return c1.createdDate < c2.createdDate ? -1 : 1;

			return 0;
		});
	};

	const getParticipantOptions = (isNew?: boolean) => {
		const removeLabel = isNew ? translate('popupSettingsSpaceShareRejectRequest') : translate('popupSettingsSpaceShareRemoveMember');
		const isReaderLimit = U.Space.getReaderLimit() <= 0;
		const isWriterLimit = U.Space.getWriterLimit() <= 0;

		let items: any[] = [
			{ id: I.ParticipantPermissions.Reader, disabled: isReaderLimit },
			{ id: I.ParticipantPermissions.Writer, disabled: isWriterLimit },
		] as any[];

		items = items.map(it => {
			it.name = translate(`participantPermissions${it.id}`);
			return it;
		});

		if (items.length) {
			items.push({ isDiv: true });
		};

		items.push({ id: 'remove', name: removeLabel, color: 'red' });

		return U.Menu.prepareForSelect(items);
	};

	const onPermissionsSelect = (item: any, isNew?: boolean) => {
		S.Menu.open('select', {
			element: `#item-${item.id}-select`,
			horizontal: I.MenuDirection.Right,
			data: {
				value: item.permissions,
				options: getParticipantOptions(isNew),
				onSelect: (e: any, el: any) => onChangePermissions(item, el.id, isNew),
			},
		});
	};

	const onChangePermissions = (item: any, v: any, isNew?: boolean) => {
		let title = '';
		let text = '';
		let button = '';
		let onConfirm = null;

		switch (v) {
			case 'remove': {
				const cb = () => {
					const my = U.Space.getParticipant();
					const members = getParticipantList().filter(it => it.id != my.id);

					if (!members.length) {
						onStopSharing();
						return;
					};
				};

				title = translate('popupConfirmMemberRemoveTitle');
				text = U.Common.sprintf(translate('popupConfirmMemberRemoveText'), item.name);
				button = translate('commonRemove');

				onConfirm = () => {
					if (isNew) {
						C.SpaceRequestDecline(space, item.identity, cb);
					} else {
						C.SpaceParticipantRemove(space, [ item.identity ], cb);
					};

					analytics.event(isNew ? 'RejectInviteRequest' : 'RemoveSpaceMember');
				};
				break;
			};

			default: {
				v = Number(v) || I.ParticipantPermissions.Reader;

				title = translate('commonAreYouSure');
				text = U.Common.sprintf(translate('popupConfirmMemberChangeText'), item.name, translate(`participantPermissions${v}`));

				onConfirm = () => {
					if (isNew) {
						C.SpaceRequestApprove(space, item.identity, v);
					} else {
						C.SpaceParticipantPermissionsChange(space, [ { identity: item.identity, permissions: Number(v) } ]);
					};

					analytics.event(isNew ? 'ApproveInviteRequest' : 'ChangeSpaceMemberPermissions', { type: v });
				};
				break;
			};
		};

		S.Popup.open('confirm', {
			data: {
				title,
				text,
				textConfirm: button,
				colorConfirm: 'red',
				onConfirm,
			},
		});
	};

	const resize = () => {
		listRef.current?.recomputeRowHeights(0);
	};

	const members = getParticipantList();
	const length = members.length;

	let limitLabel = '';
	let limitButton = '';
	let showLimit = false;
	let memberUpgradeType = '';

	if (spaceview.isShared && !U.Space.getReaderLimit() && membership.tierItem.price) {
		limitLabel = translate('popupSettingsSpaceShareInvitesReaderLimitReachedLabel');
		limitButton = translate('popupSettingsSpaceShareInvitesReaderLimitReachedButton');
		memberUpgradeType = 'members';
		showLimit = true;
	};

	const Member = (item: any) => {
		const isCurrent = item.id == participant?.id;
		const isNew = item.isJoining;

		let button = null;

		if (isOwner) {
			if (isCurrent) {
				button = <Label text={translate(`participantPermissions${item.permissions}`)} />;
			} else {
				const placeholder = isNew ? translate('popupSettingsSpaceShareSelectPermissions') : translate(`participantPermissions${item.permissions}`);

				button = (
					<div id={`item-${item.id}-select`} className="select" onClick={() => onPermissionsSelect(item, isNew)}>
						<div className="item">
							<div className="name">{placeholder}</div>
						</div>
						<Icon className={[ 'arrow', isNew ? 'light' : 'dark' ].join(' ')} />
					</div>
				);
			};
		} else
		if (item.isActive) {
			button = <Label color="grey" text={translate(`participantPermissions${item.permissions}`)} />;
		} else
		if (item.isDeclined || item.isRemoved) {
			button = <Label color="red" text={translate(`participantStatus${item.status}`)} />;
		};

		return (
			<div id={`item-${item.id}`} className={[ 'row', isNew ? 'isNew' : '' ].join(' ')} style={item.style} >
				<div className="side left" onClick={() => U.Object.openConfig(item)}>
					<IconObject size={48} object={item} />
					<ObjectName object={item} />
					{isCurrent ? <div className="caption">({translate('commonYou')})</div> : ''}
				</div>
				<div className="side right">
					{button}
				</div>
			</div>
		);
	};

	const rowRenderer = (param: any) => {
		const item: any = members[param.index];
		return (
			<CellMeasurer
				key={param.key}
				parent={param.parent}
				cache={cache.current}
				columnIndex={0}
				rowIndex={param.index}
				hasFixedWidth={() => {}}
			>
				<Member key={item.id} {...item} index={param.index} style={param.style} />
			</CellMeasurer>
		);
	};

	useEffect(() => {
		resize();
	}, [ length ]);

	return (
		<div
			ref={nodeRef}
			id="sectionMembers"
			className="section sectionMembers"
		>
			<div className="membersTitle">
				<Title text={translate('commonMembers')} />
				{length > 1 ? <Label text={String(length)} /> : ''}
			</div>

			{showLimit ? (
				<div className="row payment">
					<Label text={limitLabel} />
					<Button className="payment" text={limitButton} onClick={() => onUpgrade(memberUpgradeType)} />
				</div>
			) : ''}

			<div id="list" className="rows">
				<WindowScroller scrollElement={U.Common.getScrollContainer(isPopup).get(0)}>
					{({ height, isScrolling, registerChild, scrollTop }) => (
						<AutoSizer disableHeight={true} className="scrollArea">
							{({ width }) => (
								<List
									ref={listRef}
									autoHeight={true}
									height={Number(height) || 0}
									width={Number(width) || 0}
									deferredMeasurmentCache={cache.current}
									rowCount={length}
									rowHeight={HEIGHT}
									rowRenderer={rowRenderer}
									onScroll={onScroll}
									isScrolling={isScrolling}
									scrollTop={scrollTop}
								/>
							)}
						</AutoSizer>
					)}
				</WindowScroller>
			</div>
		</div>
	);

}));

export default Members;