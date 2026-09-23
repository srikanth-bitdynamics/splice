package org.lfdecentralizedtrust.splice.integration.tests

import org.lfdecentralizedtrust.splice.automation.Trigger
import org.lfdecentralizedtrust.splice.codegen.java.splice.amulet.{
  UnclaimedActivityRecord,
  UnclaimedReward,
}
import org.lfdecentralizedtrust.splice.codegen.java.splice.dsorules.actionrequiringconfirmation.ARC_DsoRules
import org.lfdecentralizedtrust.splice.codegen.java.splice.dsorules.dsorules_actionrequiringconfirmation.{
  SRARC_CreateUnallocatedUnclaimedActivityRecord,
  SRARC_CreateUnclaimedRewardBurnInstruction,
}
import org.lfdecentralizedtrust.splice.codegen.java.splice.dsorules.{
  DsoRules_CreateUnallocatedUnclaimedActivityRecord,
  DsoRules_CreateUnclaimedRewardBurnInstruction,
  UnallocatedUnclaimedActivityRecord,
  UnclaimedRewardBurnInstruction,
}
import org.lfdecentralizedtrust.splice.console.ValidatorAppBackendReference
import org.lfdecentralizedtrust.splice.integration.EnvironmentDefinition
import org.lfdecentralizedtrust.splice.sv.automation.delegatebased.{
  AllocateUnallocatedUnclaimedActivityRecordTrigger,
  ExecuteUnclaimedRewardBurnInstructionTrigger,
  ExpiredUnallocatedUnclaimedActivityRecordTrigger,
  ExpiredUnclaimedActivityRecordTrigger,
  ExpiredUnclaimedRewardBurnInstructionTrigger,
}
import org.lfdecentralizedtrust.splice.integration.tests.SpliceTests.SpliceTestConsoleEnvironment
import org.lfdecentralizedtrust.splice.util.{Tags, TriggerTestUtil}
import org.lfdecentralizedtrust.splice.util.WalletTestUtil
import org.lfdecentralizedtrust.splice.wallet.automation.CollectRewardsAndMergeAmuletsTrigger
import com.daml.ledger.javaapi.data.Identifier

import java.time.Instant
import java.time.temporal.ChronoUnit

@org.lfdecentralizedtrust.splice.util.scalatesttags.SpliceDsoGovernance_0_1_14
@org.lfdecentralizedtrust.splice.util.scalatesttags.SpliceAmulet_0_1_10
class UnclaimedActivityRecordIntegrationTest
    extends SvIntegrationTestBase
    with TriggerTestUtil
    with WalletTestUtil {

  // TODO(#3549): scan_txlog does not handle unclaimed activity records correctly, so this is currently disabled.
  //  We should decide whether we want to fix scan_txlog for UnclaimedActivityRecords, or narrow its scope enough that we won't care
  //  (i.e. don't try to be complete, don't use it to assert on scan's aggregates, etc)
  override protected def runUpdateHistorySanityCheck: Boolean = false

  override def environmentDefinition
      : org.lfdecentralizedtrust.splice.integration.EnvironmentDefinition =
    EnvironmentDefinition
      .simpleTopology1Sv(this.getClass.getSimpleName)

  override protected lazy val sanityChecksIgnoredRootCreates: Seq[Identifier] = Seq(
    UnclaimedReward.TEMPLATE_ID_WITH_PACKAGE_ID
  )

  private def allocateTriggers(implicit env: SpliceTestConsoleEnvironment): Seq[Trigger] =
    activeSvs.map(
      _.dsoDelegateBasedAutomation.trigger[AllocateUnallocatedUnclaimedActivityRecordTrigger]
    )

  private def expiredUnallocatedTriggers(implicit env: SpliceTestConsoleEnvironment): Seq[Trigger] =
    activeSvs.map(
      _.dsoDelegateBasedAutomation.trigger[ExpiredUnallocatedUnclaimedActivityRecordTrigger]
    )

  private def expiredUnclaimedTriggers(implicit env: SpliceTestConsoleEnvironment): Seq[Trigger] =
    activeSvs.map(_.dsoDelegateBasedAutomation.trigger[ExpiredUnclaimedActivityRecordTrigger])

  private def burnTriggers(implicit env: SpliceTestConsoleEnvironment): Seq[Trigger] =
    activeSvs.map(
      _.dsoDelegateBasedAutomation.trigger[ExecuteUnclaimedRewardBurnInstructionTrigger]
    )

  private def expiredBurnTriggers(implicit env: SpliceTestConsoleEnvironment): Seq[Trigger] =
    activeSvs.map(
      _.dsoDelegateBasedAutomation.trigger[ExpiredUnclaimedRewardBurnInstructionTrigger]
    )

  private def burnInstructions()(implicit env: SpliceTestConsoleEnvironment) =
    sv1Backend.participantClient.ledger_api_extensions.acs
      .filterJava(UnclaimedRewardBurnInstruction.COMPANION)(dsoParty)

  private def unclaimedRewardTotal()(implicit env: SpliceTestConsoleEnvironment): BigDecimal =
    sv1Backend.participantClient.ledger_api_extensions.acs
      .filterJava(UnclaimedReward.COMPANION)(dsoParty)
      .map(r => scala.math.BigDecimal(r.data.amount))
      .sum

  private def createBurnVoteRequest(amountToBurn: Double, expiresAt: Instant)(implicit
      env: SpliceTestConsoleEnvironment
  ): Unit = {
    val sv1Party = sv1Backend.getDsoInfo().svParty
    val action = new ARC_DsoRules(
      new SRARC_CreateUnclaimedRewardBurnInstruction(
        new DsoRules_CreateUnclaimedRewardBurnInstruction(
          BigDecimal(amountToBurn).bigDecimal,
          "sv1 missed milestone 2 - vote",
          expiresAt,
        )
      )
    )
    sv1Backend.createVoteRequest(
      sv1Party.toProtoPrimitive,
      action,
      "url",
      "sv1 missed milestone 2",
      sv1Backend.getDsoInfo().dsoRules.payload.config.voteRequestTimeout,
      None,
    )
  }

  private def mergeAmuletsTrigger(
      validatorBackend: ValidatorAppBackendReference,
      userName: String,
  ): Trigger =
    validatorBackend
      .userWalletAutomation(userName)
      .futureValue
      .trigger[CollectRewardsAndMergeAmuletsTrigger]

  "An UnallocatedUnclaimedActivityRecord gets expired" in { implicit env =>
    val sv1Party = sv1Backend.getDsoInfo().svParty
    val aliceUserName = aliceWalletClient.config.ledgerApiUser
    val aliceParty = aliceValidatorBackend.onboardUser(aliceUserName)
    val amountToMint = 15.0

    setTriggersWithin(
      triggersToPauseAtStart = allocateTriggers
    ) {
      setTriggersWithin(
        triggersToPauseAtStart = expiredUnallocatedTriggers,
        triggersToResumeAtStart = Seq.empty,
      ) {
        actAndCheck(
          "Creating vote request", {
            val action = new ARC_DsoRules(
              new SRARC_CreateUnallocatedUnclaimedActivityRecord(
                new DsoRules_CreateUnallocatedUnclaimedActivityRecord(
                  aliceParty.toProtoPrimitive,
                  BigDecimal(amountToMint).bigDecimal,
                  "alice is doing great - vote",
                  Instant.now().plus(5, ChronoUnit.SECONDS),
                )
              )
            )
            sv1Backend.createVoteRequest(
              sv1Party.toProtoPrimitive,
              action,
              "url",
              "alice is doing great",
              sv1Backend.getDsoInfo().dsoRules.payload.config.voteRequestTimeout,
              None,
            )
          },
        )(
          "vote request and UnallocatedUnclaimedActivityRecord have been created",
          _ => {
            sv1Backend.participantClient.ledger_api_extensions.acs
              .filterJava(UnallocatedUnclaimedActivityRecord.COMPANION)(
                dsoParty
              ) should not be empty withClue "UnallocatedUnclaimedActivityRecord"
          },
        )
      }

      clue("UnallocatedUnclaimedActivityRecord gets archived") {
        eventually() {
          sv1Backend.participantClient.ledger_api_extensions.acs
            .filterJava(UnallocatedUnclaimedActivityRecord.COMPANION)(
              dsoParty
            ) shouldBe empty withClue "UnallocatedUnclaimedActivityRecord"
        }
      }
    }
  }

  "An UnclaimedActivityRecord gets expired" in { implicit env =>
    val sv1UserId = sv1WalletClient.config.ledgerApiUser
    val sv1Party = sv1Backend.getDsoInfo().svParty
    val aliceUserName = aliceWalletClient.config.ledgerApiUser
    val aliceParty = aliceValidatorBackend.onboardUser(aliceUserName)
    val amountToMint = 15.0
    val unclaimedRewardsToMint = Seq(15.0)

    clue("Mint some unclaimed rewards") {
      unclaimedRewardsToMint.foreach { amount =>
        createUnclaimedReward(
          sv1ValidatorBackend.participantClientWithAdminToken,
          sv1UserId,
          amount,
        )
      }
      sv1Backend.participantClient.ledger_api_extensions.acs
        .filterJava(UnclaimedReward.COMPANION)(
          dsoParty
        ) should not be empty withClue "UnclaimedReward"
    }

    setTriggersWithin(
      triggersToPauseAtStart = Seq(mergeAmuletsTrigger(aliceValidatorBackend, aliceUserName))
    ) {
      setTriggersWithin(
        triggersToPauseAtStart = expiredUnallocatedTriggers ++ expiredUnclaimedTriggers
      ) {
        actAndCheck(
          "Creating vote request", {
            val action = new ARC_DsoRules(
              new SRARC_CreateUnallocatedUnclaimedActivityRecord(
                new DsoRules_CreateUnallocatedUnclaimedActivityRecord(
                  aliceParty.toProtoPrimitive,
                  BigDecimal(amountToMint).bigDecimal,
                  "alice is doing great - vote",
                  Instant.now().plus(10, ChronoUnit.SECONDS),
                )
              )
            )
            sv1Backend.createVoteRequest(
              sv1Party.toProtoPrimitive,
              action,
              "url",
              "alice is doing great",
              sv1Backend.getDsoInfo().dsoRules.payload.config.voteRequestTimeout,
              None,
            )
          },
        )(
          "UnclaimedActivityRecord has been created",
          _ => {
            sv1Backend.participantClient.ledger_api_extensions.acs
              .filterJava(UnclaimedActivityRecord.COMPANION)(
                dsoParty
              ) should not be empty withClue "UnclaimedActivityRecord"
            sv1Backend.participantClient.ledger_api_extensions.acs
              .filterJava(UnclaimedReward.COMPANION)(
                dsoParty
              ) shouldBe empty withClue "UnclaimedReward"
          },
        )
      }

      clue("UnclaimedActivityRecord gets archived") {
        eventually() {
          sv1Backend.participantClient.ledger_api_extensions.acs
            .filterJava(UnclaimedActivityRecord.COMPANION)(
              dsoParty
            ) shouldBe empty withClue "UnclaimedActivityRecord"
        }
      }
    }
  }

  "Amulet gets minted" in { implicit env =>
    val sv1UserId = sv1WalletClient.config.ledgerApiUser
    val sv1Party = sv1Backend.getDsoInfo().svParty
    val aliceUserName = aliceWalletClient.config.ledgerApiUser
    val aliceParty = aliceValidatorBackend.onboardUser(aliceUserName)
    val unclaimedRewardsToMint = Seq(12.0, 2.0, 5.0)
    val amountToMint = 15.0

    aliceWalletClient.list().amulets should have length 0

    clue("Mint some unclaimed rewards") {
      unclaimedRewardsToMint.foreach { amount =>
        createUnclaimedReward(
          sv1ValidatorBackend.participantClientWithAdminToken,
          sv1UserId,
          amount,
        )
      }
      sv1Backend.participantClient.ledger_api_extensions.acs
        .filterJava(UnclaimedReward.COMPANION)(
          dsoParty
        ) should not be empty withClue "UnclaimedReward"
    }

    setTriggersWithin(
      triggersToPauseAtStart = Seq(mergeAmuletsTrigger(aliceValidatorBackend, aliceUserName)),
      triggersToResumeAtStart = Seq.empty,
    ) {
      actAndCheck(
        "Creating vote request", {
          val action = new ARC_DsoRules(
            new SRARC_CreateUnallocatedUnclaimedActivityRecord(
              new DsoRules_CreateUnallocatedUnclaimedActivityRecord(
                aliceParty.toProtoPrimitive,
                BigDecimal(amountToMint).bigDecimal,
                "alice is doing great - vote",
                Instant.now().plus(1, ChronoUnit.DAYS),
              )
            )
          )
          sv1Backend.createVoteRequest(
            sv1Party.toProtoPrimitive,
            action,
            "url",
            "alice is doing great",
            sv1Backend.getDsoInfo().dsoRules.payload.config.voteRequestTimeout,
            None,
          )
        },
      )(
        "UnclaimedActivityRecord has been created",
        _ => {
          sv1Backend.participantClient.ledger_api_extensions.acs
            .filterJava(UnclaimedActivityRecord.COMPANION)(
              dsoParty
            ) should not be empty withClue "UnclaimedActivityRecord"

          val unclaimedRewardLeftover: BigDecimal =
            sv1Backend.participantClient.ledger_api_extensions.acs
              .filterJava(UnclaimedReward.COMPANION)(dsoParty)
              .map(r => scala.math.BigDecimal(r.data.amount))
              .sum
          unclaimedRewardLeftover shouldBe BigDecimal(unclaimedRewardsToMint.sum - amountToMint)
        },
      )
    }

    clue("Amulet gets minted") {
      eventually() {
        aliceWalletClient.list().amulets should have length 1
      }
    }

    clue("UnclaimedActivityRecord gets archived") {
      eventually() {
        sv1Backend.participantClient.ledger_api_extensions.acs
          .filterJava(UnclaimedActivityRecord.COMPANION)(
            dsoParty
          ) shouldBe empty withClue "UnclaimedActivityRecord"
      }
    }
  }

  "UnclaimedRewards get burned" taggedAs Tags.SpliceDsoGovernance_0_1_30 in { implicit env =>
    val sv1UserId = sv1WalletClient.config.ledgerApiUser
    val amountToBurn = 15.0

    clue("Mint some unclaimed rewards") {
      Seq(12.0, 2.0, 5.0).foreach { amount =>
        createUnclaimedReward(
          sv1ValidatorBackend.participantClientWithAdminToken,
          sv1UserId,
          amount,
        )
      }
    }
    val poolBefore = unclaimedRewardTotal()

    actAndCheck(
      "Creating vote request",
      createBurnVoteRequest(amountToBurn, Instant.now().plus(1, ChronoUnit.DAYS)),
    )(
      "the burn instruction has been executed",
      _ => {
        burnInstructions() shouldBe empty
        unclaimedRewardTotal() shouldBe poolBefore - BigDecimal(amountToBurn)
      },
    )
  }

  "An UnclaimedRewardBurnInstruction gets expired" taggedAs Tags.SpliceDsoGovernance_0_1_30 in {
    implicit env =>
      setTriggersWithin(
        triggersToPauseAtStart = burnTriggers
      ) {
        setTriggersWithin(
          triggersToPauseAtStart = expiredBurnTriggers,
          triggersToResumeAtStart = Seq.empty,
        ) {
          actAndCheck(
            "Creating vote request for a burn that is not executed in time",
            createBurnVoteRequest(15.0, Instant.now().plus(5, ChronoUnit.SECONDS)),
          )(
            "UnclaimedRewardBurnInstruction has been created",
            _ => burnInstructions() should not be empty,
          )
        }

        clue("UnclaimedRewardBurnInstruction gets archived") {
          eventually() {
            burnInstructions() shouldBe empty
          }
        }
      }
  }
}
