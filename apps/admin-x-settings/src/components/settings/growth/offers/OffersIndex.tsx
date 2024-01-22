import useFeatureFlag from '../../../../hooks/useFeatureFlag';
import {Button, Tab, TabView} from '@tryghost/admin-x-design-system';
import {ButtonGroup, ButtonProps} from '@tryghost/admin-x-design-system';
import {Modal} from '@tryghost/admin-x-design-system';
import {NoValueLabel} from '@tryghost/admin-x-design-system';
import {SortMenu} from '@tryghost/admin-x-design-system';
import {Tier, useBrowseTiers} from '@tryghost/admin-x-framework/api/tiers';
import {Tooltip} from '@tryghost/admin-x-design-system';
import {currencyToDecimal, getSymbol} from '../../../../utils/currency';
import {getHomepageUrl} from '@tryghost/admin-x-framework/api/site';
import {numberWithCommas} from '../../../../utils/helpers';
import {useBrowseOffers} from '@tryghost/admin-x-framework/api/offers';
import {useEffect, useState} from 'react';
import {useGlobalData} from '../../../providers/GlobalDataProvider';
import {useModal} from '@ebay/nice-modal-react';
import {useRouting} from '@tryghost/admin-x-framework/routing';
import {useSortingState} from '../../../providers/SettingsAppProvider';

export type OfferType = 'percent' | 'fixed' | 'trial';

export const createRedemptionFilterUrl = (id: string): string => {
    const baseHref = '/ghost/#/members';
    const filterValue = `offer_redemptions:[${id}]`;
    return `${baseHref}?filter=${encodeURIComponent(filterValue)}`;
};

export const getOfferCadence = (cadence: string): string => {
    return cadence === 'month' ? 'monthly' : 'yearly';
};

export const getOfferDuration = (duration: string): string => {
    return (duration === 'once' ? 'First payment' : duration === 'repeating' ? 'Repeating' : 'Forever');
};

export const getOfferDiscount = (type: string, amount: number, cadence: string, currency: string, tier: Tier | undefined): {discountColor: string, discountOffer: string, originalPriceWithCurrency: string, updatedPriceWithCurrency: string} => {
    let discountColor = '';
    let discountOffer = '';
    const originalPrice = cadence === 'month' ? tier?.monthly_price ?? 0 : tier?.yearly_price ?? 0;
    let updatedPrice = originalPrice;

    const formatToTwoDecimals = (num: number): number => parseFloat(num.toFixed(2));

    let originalPriceWithCurrency = getSymbol(currency) + numberWithCommas(formatToTwoDecimals(currencyToDecimal(originalPrice)));

    switch (type) {
    case 'percent':
        discountColor = 'text-green';
        discountOffer = amount + '% off';
        updatedPrice = originalPrice - ((originalPrice * amount) / 100);
        break;
    case 'fixed':
        discountColor = 'text-blue';
        discountOffer = numberWithCommas(formatToTwoDecimals(currencyToDecimal(amount))) + ' ' + currency + ' off';
        updatedPrice = originalPrice - amount;
        break;
    case 'trial':
        discountColor = 'text-pink';
        discountOffer = amount + ' days free';
        originalPriceWithCurrency = '';
        break;
    default:
        break;
    };

    // Check if updatedPrice is negative, if so, set it to 0
    if (updatedPrice < 0) {
        updatedPrice = 0;
    }

    const updatedPriceWithCurrency = getSymbol(currency) + numberWithCommas(formatToTwoDecimals(currencyToDecimal(updatedPrice)));

    return {
        discountColor,
        discountOffer,
        originalPriceWithCurrency,
        updatedPriceWithCurrency
    };
};

export const CopyLinkButton: React.FC<{offerCode: string}> = ({offerCode}) => {
    const [isCopied, setIsCopied] = useState(false);
    const {siteData} = useGlobalData();

    const handleCopyClick = (e?: React.MouseEvent<HTMLElement, MouseEvent>) => {
        e?.stopPropagation();
        const offerLink = `${getHomepageUrl(siteData!)}${offerCode}`;
        navigator.clipboard.writeText(offerLink);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    return <Tooltip containerClassName='group-hover:opacity-100 opacity-0 inline-flex items-center -mr-1 justify-center leading-none w-5 h-5' content={isCopied ? 'Copied' : 'Copy link'} size='sm'><Button color='clear' hideLabel={true} icon={isCopied ? 'check-circle' : 'hyperlink-circle'} iconColorClass={isCopied ? 'text-green w-[14px] h-[14px]' : 'w-[18px] h-[18px]'} label={isCopied ? 'Copied' : 'Copy'} unstyled={true} onClick={handleCopyClick} /></Tooltip>;
};

export const OffersIndexModal = () => {
    const modal = useModal();
    const {updateRoute} = useRouting();
    const hasOffers = useFeatureFlag('adminXOffers');
    const {data: {offers: allOffers = []} = {}} = useBrowseOffers({
        searchParams: {
            limit: 'all'
        }
    });
    const {data: {tiers: allTiers} = {}} = useBrowseTiers();
    const activeOffers = allOffers.filter((offer) => {
        const offerTier = allTiers?.find(tier => tier.id === offer?.tier.id);
        return (offer.status === 'active' && offerTier && offerTier.active === true);
    });
    const archivedOffers = allOffers.filter((offer) => {
        const offerTier = allTiers?.find(tier => tier.id === offer?.tier.id);
        return (offer.status === 'archived' || (offerTier && offerTier.active === false));
    });

    let offersTabs: Tab[] = [
        {id: 'active', title: 'Active'},
        {id: 'archived', title: 'Archived'}
    ];

    const {sortingState, setSortingState} = useSortingState();
    const offersSorting = sortingState?.find(sorting => sorting.type === 'offers');

    const [selectedTab, setSelectedTab] = useState('active');

    const sortOption = offersSorting?.option || 'date-added';
    const sortDirection = offersSorting?.direction || 'desc';

    useEffect(() => {
        if (!hasOffers) {
            modal.remove();
            updateRoute('');
        }
    }, [hasOffers, modal, updateRoute]);

    const handleOfferEdit = (id:string) => {
        // TODO: implement
        sessionStorage.setItem('editOfferPageSource', 'offersIndex');
        updateRoute(`offers/edit/${id}`);
    };

    const sortedOffers = allOffers
        .sort((offer1, offer2) => {
            const multiplier = sortDirection === 'desc' ? -1 : 1;
            switch (sortOption) {
            case 'name':
                return multiplier * offer1.name.localeCompare(offer2.name);
            case 'redemptions':
                return multiplier * (offer1.redemption_count - offer2.redemption_count);
            default:
                // 'date-added' or unknown option, use default sorting
                return multiplier * ((offer1.created_at ? new Date(offer1.created_at).getTime() : 0) - (offer2.created_at ? new Date(offer2.created_at).getTime() : 0));
            }
        });

    const listLayoutOutput = <div className='overflow-x-auto'>
        <table className='m-0 w-full'>
            {(selectedTab === 'active' && activeOffers.length > 0) || (selectedTab === 'archived' && archivedOffers.length > 0) ?
                <tr className='border-b border-b-grey-300 dark:border-grey-800'>
                    <th className='px-5 py-2.5 pl-0 text-xs font-normal text-grey-700'>{selectedTab === 'active' ? activeOffers.length : archivedOffers.length} {selectedTab === 'active' ? (activeOffers.length !== 1 ? 'offers' : 'offer') : (archivedOffers.length !== 1 ? 'offers' : 'offer')}</th>
                    <th className='px-5 py-2.5 text-xs font-normal text-grey-700'>Terms</th>
                    <th className='px-5 py-2.5 text-xs font-normal text-grey-700'>Price</th>
                    <th className='px-5 py-2.5 text-xs font-normal text-grey-700'>Redemptions</th>
                    <th className='min-w-[80px] px-5 py-2.5 pr-0 text-xs font-normal text-grey-700'></th>
                </tr> :
                null
            }
            {sortedOffers.filter((offer) => {
                const offerTier = allTiers?.find(tier => tier.id === offer?.tier.id);
                //Check to filter out offers with archived offerTier
                return (selectedTab === 'active' && (offer.status === 'active' && offerTier && offerTier.active === true)) ||
                (selectedTab === 'archived' && (offer.status === 'archived' || (offerTier && offerTier.active === false)));
            }).map((offer) => {
                const offerTier = allTiers?.find(tier => tier.id === offer?.tier.id);

                if (!offerTier) {
                    return null;
                }

                const isTierArchived = offerTier?.active === false;

                const {discountOffer, originalPriceWithCurrency, updatedPriceWithCurrency} = getOfferDiscount(offer.type, offer.amount, offer.cadence, offer.currency || 'USD', offerTier);

                return (
                    <tr className={`group relative scale-100 border-b border-b-grey-200 dark:border-grey-800`}>
                        <td className={`${isTierArchived ? 'opacity-50' : ''} p-0`}><a className={`block ${isTierArchived ? 'cursor-default select-none' : 'cursor-pointer'} p-5 pl-0`} onClick={!isTierArchived ? () => handleOfferEdit(offer?.id ? offer.id : '') : () => {}}><span className='font-semibold'>{offer?.name}</span><br /><span className='text-sm text-grey-700'>{offerTier.name} {getOfferCadence(offer.cadence)}</span></a></td>
                        <td className={`${isTierArchived ? 'opacity-50' : ''} whitespace-nowrap p-0 text-sm`}><a className={`block ${isTierArchived ? 'cursor-default select-none' : 'cursor-pointer'} p-5`} onClick={!isTierArchived ? () => handleOfferEdit(offer?.id ? offer.id : '') : () => {}}><span className='text-[1.3rem] font-medium uppercase'>{discountOffer}</span><br /><span className='text-grey-700'>{offer.type !== 'trial' ? getOfferDuration(offer.duration) : 'Trial period'}</span></a></td>
                        <td className={`${isTierArchived ? 'opacity-50' : ''} whitespace-nowrap p-0 text-sm`}><a className={`block ${isTierArchived ? 'cursor-default select-none' : 'cursor-pointer'} p-5`} onClick={!isTierArchived ? () => handleOfferEdit(offer?.id ? offer.id : '') : () => {}}><span className='font-medium'>{updatedPriceWithCurrency}</span> {offer.type !== 'trial' ? <span className='relative text-xs text-grey-700 before:absolute before:-inset-x-0.5 before:top-1/2 before:rotate-[-20deg] before:border-t before:content-[""]'>{originalPriceWithCurrency}</span> : null}</a></td>
                        <td className={`${isTierArchived ? 'opacity-50' : ''} w-[120px] whitespace-nowrap p-0 text-sm`}><a className={`block ${isTierArchived ? 'cursor-default select-none' : 'cursor-pointer'} p-5 ${offer.redemption_count === 0 ? '' : 'hover:underline'}`} href={offer.redemption_count > 0 ? createRedemptionFilterUrl(offer.id ? offer.id : '') : undefined} onClick={offer.redemption_count === 0 ? !isTierArchived ? () => handleOfferEdit(offer?.id ? offer.id : '') : () => {} : () => {}}>{offer.redemption_count}</a></td>
                        <td className={`${isTierArchived ? 'opacity-50' : ''} w-[120px] whitespace-nowrap p-5 pr-8 text-right text-sm leading-none`}>{!isTierArchived ? <CopyLinkButton offerCode={offer.code} /> : null}</td>
                        {isTierArchived ?
                            <div className='absolute right-0 top-[11px] whitespace-nowrap rounded-sm bg-black px-2 py-0.5 text-xs leading-normal text-white opacity-0 transition-all group-hover:opacity-100 dark:bg-grey-950'>This offer is disabled, because <br /> it is tied to an archived tier.</div> :
                            null
                        }
                    </tr>
                );
            })}
        </table>
    </div>;

    const buttons: ButtonProps[] = [
        {
            key: 'cancel-modal',
            label: 'Close',
            onClick: () => {
                modal.remove();
                updateRoute('offers');
            }
        },
        {
            key: 'new-offer',
            icon: 'add',
            label: 'New offer',
            color: 'green',
            onClick: () => updateRoute('offers/new')
        }
    ];

    return <Modal
        afterClose={() => {
            updateRoute('offers');
        }}
        animate={false}
        backDropClick={false}
        cancelLabel=''
        footer={false}
        header={false}
        height='full'
        size='lg'
        testId='offers-modal'
        width={1140}
    >
        <div className='pt-6'>
            <header>
                <div className='flex items-center justify-between'>
                    <div>
                        <TabView
                            border={false}
                            selectedTab={selectedTab}
                            tabs={offersTabs}
                            width='wide'
                            onTabChange={setSelectedTab}
                        />
                    </div>
                    <ButtonGroup buttons={buttons} />
                </div>
                <div className='mt-12 flex items-center justify-between border-b border-b-grey-300 pb-2.5 dark:border-b-grey-800'>
                    <h1 className='text-3xl'>{offersTabs.find(tab => tab.id === selectedTab)?.title} offers</h1>
                    <div>
                        <SortMenu
                            direction={sortDirection as 'asc' | 'desc'}
                            items={[
                                {id: 'date-added', label: 'Date added', selected: sortOption === 'date-added', direction: sortDirection as 'asc' | 'desc'},
                                {id: 'name', label: 'Name', selected: sortOption === 'name', direction: sortDirection as 'asc' | 'desc'},
                                {id: 'redemptions', label: 'Redemptions', selected: sortOption === 'redemptions', direction: sortDirection as 'asc' | 'desc'}
                            ]}
                            position='right'
                            onDirectionChange={(selectedDirection) => {
                                const newDirection = selectedDirection === 'asc' ? 'desc' : 'asc';
                                setSortingState?.([{
                                    type: 'offers',
                                    option: sortOption,
                                    direction: newDirection
                                }]);
                            }}
                            onSortChange={(selectedOption) => {
                                setSortingState?.([{
                                    type: 'offers',
                                    option: selectedOption,
                                    direction: sortDirection
                                }]);
                            }}
                        />
                    </div>
                </div>
            </header>
            {selectedTab === 'active' && activeOffers.length === 0 ?
                <NoValueLabel icon='tags-block'>
                    No offers found.
                </NoValueLabel> :
                null
            }
            {selectedTab === 'archived' && archivedOffers.length === 0 ?
                <NoValueLabel icon='tags-block'>
                    No offers found.
                </NoValueLabel> :
                null
            }
            {listLayoutOutput}
        </div>
    </Modal>;
};
