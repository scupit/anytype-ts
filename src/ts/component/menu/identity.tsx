import React, { forwardRef } from 'react';
import { observer } from 'mobx-react';
import { Button, Icon, Label, Title } from 'Component';
import { I, translate, Action, } from 'Lib';

const MenuIdentity = observer(forwardRef<I.MenuRef, I.Menu>((props, ref) => {

	const { close } = props;

	const onClick = () => {
		Action.openSettings('membership', '');
		close();
	};

	return (
		<>
			<div className="iconWrapper">
				<Icon />
			</div>

			<Title text={translate('headerSettingsIdentityInfoTitle')} />
			<Label text={translate('headerSettingsIdentityInfoText')} />
			<Button className="c36" text={translate('headerSettingsIdentityInfoExplorePlans')} onClick={onClick} />
		</>
	);
}));

export default MenuIdentity;
