import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { RelayPool } from "nostr-relaypool";
import { convertTimestamp } from "../utils";
import { defaultRelaysToPublish, defaultRelays } from "../const";
import { nip19 } from "nostr-tools";

import SideBarMenu from "../components/menus/sidebarMenu/sidebarMenu";
import BountiesNotFound from "../components/errors/bountiesNotFound";
import ProfileCard from "../components/profileCard/profileCard";
import ProfileActivity from "../components/profileCard/profileStats/profileActivity";
import BountiesPaid from "../components/profileCard/profileStats/profileBountiesPaid";
import Nip05Verified from "../components/profileCard/profileStats/profileBountiesNip05";
import BountiesProgress from "../components/profileCard/profileStats/profileBountiesProgress";
import BountyCard from "../components/bounty/bountyCardShortInfo/bountyCardShortInfo";
import MobileMenu from "../components/menus/mobileMenu/mobileMenu";

function Profile() {
  const params = useParams();
  let relays = defaultRelaysToPublish;
  let userMetaDataRelays = defaultRelays;
  let userPubkey = nip19.decode(params.id!).data;
  let last30DaysTimestamp = Math.floor(Date.now() / 1000) - 24 * 60 * 60 * 1000;

  let [metaData, setMetada] = useState({});
  let [titles, setTitles] = useState<string[]>([]);
  let [rewards, setRewards] = useState<string[]>([]);
  let [name, setName] = useState<string>("");
  let [picture, setPicture] = useState<string>("");
  let [ids, setIds] = useState<string[]>([]);
  let [bountyNotFound, setBountyNotFound] = useState(false);
  let [dataLoaded, setDataLoaded] = useState(false);
  let [pubkey, setPubkeys] = useState<string[]>([]);
  let [creationDate, setCreationDate] = useState<string[]>([]);
  let [bountyTags, setBountyTags] = useState<string[][]>([]);
  let [userNip05, setUserNip05] = useState(false);
  let [statuses, setStatuses] = useState<string[]>([]);
  let [Last30Days, setLast30Days] = useState(0);

  let subFilterMetaData = [
    {
      authors: [`${userPubkey}`],
      kinds: [0],
    },
  ];
  let subFilterOlderPost = [
    {
      authors: [`${userPubkey}`],
      kinds: [1],
      since: last30DaysTimestamp,
      limit: 30,
    },
  ];
 
  let subFilterContent = [
    {
      authors: [`${userPubkey}`],
      kinds: [30023],
      "#t": ["bounty"],
    },
  ];

  let checkBountyExist = [];

  useEffect(() => {
    let relayPool = new RelayPool(relays);

    relayPool.onerror((err, relayUrl) => {
      console.log("RelayPool error", err, " from relay ", relayUrl);
    });
    relayPool.onnotice((relayUrl, notice) => {
      console.log("RelayPool notice", notice, " from relay ", relayUrl);
    });

    relayPool.subscribe(
      subFilterMetaData,
      userMetaDataRelays,
      (event, isAfterEose, relayURL) => {
        let parsedContent = JSON.parse(event.content);

        let finalData = {
          name: parsedContent.display_name,
          display_name: parsedContent.display_name,
          profilePic: parsedContent.picture,
          LnAddress: parsedContent.lud16,
          about: parsedContent.about,
          nip05: parsedContent.nip05,
        };

        setMetada(finalData);
        setName(parsedContent.display_name);
        setPicture(parsedContent.picture);

        if (parsedContent.nip05 !== "" || undefined) {
          let url = parsedContent.nip05.split("@");
          fetch(`https://${url[1]}/.well-known/nostr.json?name=${url[0]}`)
            .then((response) => response.json())
            .then((data) => {
              let userNamePubKey = data.names[`${url[0]}`];
              let isSamePubkey = event.pubkey === userNamePubKey;
              if (isSamePubkey) setUserNip05(true);
            });
        }
      }
    );

    relayPool.subscribe(
      subFilterOlderPost,
      userMetaDataRelays,
      (event, isAfterEose, relayURL) => {
        setLast30Days((item) => item + 1);
      }
    );

    relayPool.subscribe(
      subFilterContent,
      relays,
      (event, isAfterEose, relayURL) => {
        let parseDate = parseInt(event.tags[3][1]);
        let date = convertTimestamp(parseDate);
        setDataLoaded(true);

        let tags_arr: string[] = [];

        event.tags.map((item) => {
          if (item[0] === "t") {
            switch (item[1]) {
              case "design-bounty":
                tags_arr.push("design");
                break;
              case "development-bounty":
                tags_arr.push("development");
                break;
              case "debugging-bounty":
                tags_arr.push("debugging");
                break;
              case "writing-bounty":
                tags_arr.push("writing");
                break;
              case "cybersecurity-bounty":
                tags_arr.push("cybersecurity");
                break;
              case "marketing-bounty":
                tags_arr.push("marketing");
                break;
            }
          }
        });
        // subscribe for statuses
        relayPool.subscribe(
          [{ "#e": [`${event.id}`], "#t": ["bounty-reply"], limit: 1 }],
          userMetaDataRelays,
          (event, isAfterEose, relayURL) => {
            setStatuses((arr) => [...arr, event.content]);
          }
        );

        let bountyTitle = event.tags[1][1];
        let bountyReward = event.tags[2][1];
        let bountyDatePosted = date;

        setBountyTags((arr) => [tags_arr, ...arr]);
        setIds((arr) => [event.id, ...arr]);
        setCreationDate((arr) => [bountyDatePosted, ...arr]);
        setTitles((arr) => [bountyTitle, ...arr]);
        setRewards((arr) => [bountyReward, ...arr]);
        setPubkeys((arr) => [event.pubkey, ...arr]);

        checkBountyExist.push(event.id);
      }
    );

    setTimeout(() => {
      relayPool.close().then(() => {
        console.log("connection closed");
      });
      if (checkBountyExist.length === 0) setBountyNotFound(true);
    }, 20000);
  }, []);

  return (
    <div className="flex justify-between sm:block">
      <div className="basis-3/12 sm:hidden">
        <SideBarMenu />
      </div>
      <div className="basis-3/12 lg:hidden md:hidden">
        <MobileMenu />
      </div>

      <div className="p-3 h-screen overflow-y-scroll basis-9/12 lg:px-10 sm:h-screen px-2 sm:mb-24 dark:bg-background-dark-mode">
        <ProfileCard metaData={metaData} userNip05={userNip05} />

        <div className="flex justify-between p-3 flex-wrap sm:block">
          <BountiesPaid bountiesPaid={statuses} />
          <BountiesProgress bountiesProgress={statuses} />
          <Nip05Verified isVerified={userNip05} />
          <ProfileActivity activity={Last30Days} />
        </div>
        {dataLoaded ? (
          titles.map((item, index) => {
            return (
              <div>
                <BountyCard
                  title={titles[index]}
                  reward={rewards[index]}
                  id={ids[index]}
                  dates={creationDate[index]}
                  pubkeys={pubkey[index]}
                  name={name}
                  picture={picture}
                  tags={bountyTags[index]}
                />
              </div>
            );
          })
        ) : (
          <div className="animate-pulse text-center p-6 font-medium text-dark-text dark:text-gray-2">
            Loading...
          </div>
        )}
        {bountyNotFound ? <BountiesNotFound /> : null}
      </div>
    </div>
  );
}

export default Profile;
